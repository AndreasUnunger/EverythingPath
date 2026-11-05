# Ported from the root-qualified external monitor (2026-10-27).
# Source SHA-256: 04208817cc54e3eec3cf27ef9641914b1bb0e8fcde30307c8942464f5fe9d7be
# Only imports, storage-baseline lookup and mapping lookup adapt to gate_core;
# the gate memory cap is option 1's (operations.md#gate-memory).
# Qualification/limitations: docs/agents/orchestration/operations.md#monitor-provenance
"""Continuous 5s observations (tool caller yields/polls at <=55s) on the saved invocation; never dispatches work."""
import json
import os
import re
import signal
import sys
from pathlib import Path
import subprocess
import time
from gate_core import env, preflight, mapping, submission, load, save, now, git, require, snapshot, execution_control
from workflow_evidence import landing_read

PROPS = ('ControlGroup ActiveState MemoryPeak MemoryCurrent Result ExecMainStatus MemoryMax '
         'MemoryHigh MemorySwapMax CPUQuotaPerSecUSec TasksMax CPUWeight Nice LimitCORE '
         'Restart TimeoutStopUSec').split()
CGFILES = ('memory.events memory.events.local memory.current memory.peak memory.stat '
           'memory.pressure cpu.stat').split()
# The gate unit's MemoryMax, which $EP_ORCH/bounded.sh sets for kind gate; the
# in-run real-memory stops and the expected unit cap follow it. Option 1 (owner,
# 2026-10-30): 2-worker gates peaked at 11.96 GiB kernel / 10.26 GiB real, and
# 15G is the smallest cap at which Node keeps its 4 GiB default heap (catalog:pin
# sets none).
GATE_MEMORY_MAX_BYTES = 15 * 1024**3
HOST_FLOOR_BYTES = 6 * 1024**3
LAUNCH_MINIMUM_BYTES = GATE_MEMORY_MAX_BYTES + HOST_FLOOR_BYTES
_last_guard = None
_guard_cache = None
_low_since = None

class StoppedEvidence(RuntimeError):
    pass

def guard_command(argv, accepted=(0,)):
    p=subprocess.run(argv,capture_output=True,text=True,timeout=4)
    require(p.returncode in accepted,'Guard instrumentation failed: '+str(argv)+' '+p.stderr)
    return dict(argv=argv,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr)

def guard_observation(v):
    """Reuse the qualified #761 observer inside this monitor; no separate daemon."""
    global _last_guard,_guard_cache,_low_since
    stamp=time.monotonic();available=int(re.search(r'^MemAvailable:\s+(\d+)',Path('/proc/meminfo').read_text(),re.M)[1])*1024
    _low_since=(_low_since if _low_since is not None else stamp) if available<HOST_FLOOR_BYTES else None
    g=dict(hostAvailableBytes=available,hostLowSeconds=stamp-_low_since if _low_since is not None else 0,observationGapSeconds=stamp-_last_guard if _last_guard is not None else 0)
    _last_guard=stamp
    if _guard_cache is None or stamp-_guard_cache['sampleMonotonic']>=3:
        prior=load(v['STORAGE_BASELINE'])
        cursor=prior['journal']['stdout'].split('-- cursor: ')[1].strip()
        pattern='BTRFS.*(error|corrupt|csum|checksum)|I/O error|ata[0-9]+.*(exception|hard resetting|EH complete)|sda.*(error|failed|timeout)'
        baseline_path=Path(v['E'])/'resource-baseline.json'
        baseline=load(baseline_path)['guard'] if baseline_path.exists() else None
        ids=guard_command(['docker','ps','-aq','--no-trunc'])['stdout'].split()
        scratch_root=Path(v['MAIN']).parent/'.ep-tmp'
        scratch=sorted({str(p) for pattern in ('local-codegen-*','e2e-*','queue-*','cur-land-*','triage-*') for p in scratch_root.glob(pattern)}|{str(p) for p in scratch_root.parent.glob('ep-gate-'+Path(v['WT']).name+'-*')})
        before_ids=baseline['dockerIdsBefore'] if baseline else ids
        before_scratch=baseline['scratchBefore'] if baseline else scratch
        labelled=guard_command(['docker','ps','-aq','--no-trunc','--filter','label=dev.everythingpath.local-convex'])['stdout'].split()
        docker=[]
        for container in labelled:
            if container in before_ids:continue
            fmt='{"id":{{json .Id}},"name":{{json .Name}},"state":{{json .State}},"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}},"image":{{json .Config.Image}}}'
            inspected=guard_command(['docker','inspect','--format',fmt,container],(0,1))
            if inspected['exitCode']:
                require(not guard_command(['docker','ps','-aq','--filter','id='+container])['stdout'],'Owned Docker instrumentation failed')
                continue
            d=json.loads(inspected['stdout']);pid=str(d['state']['Pid']);p=Path('/proc')/pid/'cgroup'
            if pid!='0' and p.exists():
                cg=Path('/sys/fs/cgroup'+p.read_text().strip().split('::',1)[1])
                d['cgroup']={n:(cg/n).read_text() for n in ('memory.current','memory.peak','memory.stat','memory.events','memory.max','memory.high','memory.swap.max','cpu.max')}
            docker.append(d)
        _guard_cache=dict(sampleMonotonic=stamp,dockerIdsBefore=before_ids,scratchBefore=before_scratch,ownedScratch=[p for p in scratch if p not in before_scratch],docker=docker,expectedStorageCounters=prior['counters']['stdout'],storage=dict(journal=guard_command(['journalctl','-k','-b','--after-cursor',cursor,'--no-pager','-o','short-iso','--show-cursor','--grep',pattern],(0,1)),counters=guard_command(['btrfs','device','stats','/home'])))
    return {**g,**_guard_cache}

def guard_violations(row):
    g=row.get('guard');bad=[]
    if not g:return [dict(guardEvidence='missing')]
    if g['hostAvailableBytes']<HOST_FLOOR_BYTES and g['hostLowSeconds']>=5:bad.append(dict(hostBelow6GiBSeconds=g['hostLowSeconds']))
    if g['observationGapSeconds']>10:bad.append(dict(instrumentationGapSeconds=g['observationGapSeconds']))
    storage=g['storage']
    if storage['journal']['exitCode']!=1:bad.append(dict(newStorageError=storage['journal']))
    if storage['counters']['stdout']!=g['expectedStorageCounters']:bad.append(dict(storageCounterChange=storage['counters']))
    for d in g['docker']:
        events=counters(d.get('cgroup',{}).get('memory.events',''))
        if d['state'].get('OOMKilled') or any(events.get(k,0)>0 for k in ('max','oom','oom_kill','oom_group_kill')):bad.append(dict(dockerResourceFailure=d['id'],events=events))
    return bad

def guard_cleanup(rows):
    """Read-only targeted checks on resources observed outside the bounded scope."""
    containers={d['id']:d for r in rows for d in r.get('guard',{}).get('docker',[])}
    volumes={m['Name'] for d in containers.values() for m in d['mounts'] if m.get('Type')=='volume'}
    scratch={p for r in rows for p in r.get('guard',{}).get('ownedScratch',[])}
    remaining_containers={c:guard_command(['docker','ps','-aq','--no-trunc','--filter','id='+c])['stdout'] for c in containers}
    remaining_volumes={n:guard_command(['docker','volume','ls','-q','--filter','name=^'+n+'$'])['stdout'] for n in volumes}
    remaining_scratch={p:Path(p).exists() for p in scratch}
    return dict(observedContainers=containers,remainingContainers=remaining_containers,remainingVolumes=remaining_volumes,remainingScratch=remaining_scratch,passed=not any([*remaining_containers.values(),*remaining_volumes.values(),*remaining_scratch.values()]),limitation='Observed resources only; terminal missing cgroups are unavailable, never zero. Docker is outside the unit/slice; no whole-host cap or combined peak claim.')

def counters(text):
    return {k: int(v) for k, v in (x.split() for x in text.splitlines())}

def real(row):
    if 'memory.current' not in row or 'memory.stat' not in row:
        return None
    st = counters(row['memory.stat'])
    return int(row['memory.current']) - st.get('file', 0) + st.get('shmem', 0)

def observe(v, s):
    row = dict(at=now(), invocationId=s['invocationId'] if s else None)
    pairs = [('slice', 'ep-heavy.slice')]
    if s:
        pairs.insert(0, ('unit', s['unit']))
    for key, unit in pairs:
        p = subprocess.run(['systemctl', '--user', 'show', unit,
              *[arg for prop in PROPS for arg in ['-p', prop]]], capture_output=True, text=True,timeout=4)
        fields = dict(x.split('=', 1) for x in p.stdout.splitlines() if '=' in x)
        r = row[key] = dict(systemd=fields, systemctlExit=p.returncode, error=p.stderr)
        if fields.get('ControlGroup'):
            cg = Path('/sys/fs/cgroup') / fields['ControlGroup'].lstrip('/')
            for name in CGFILES:
                try:
                    r[name] = (cg / name).read_text()
                except FileNotFoundError:
                    pass  # Terminal disappearance is unavailable evidence, never zero.
    if s:
        p = Path(v['ORCH']) / 'bounded' / s['invocationId'] / 'memory'
        if p.exists():
            row['boundedSample'] = p.read_text()
        with landing_read(v):
            row['candidateStatus'] = git(v['WT'], 'status', '--porcelain')
            row['candidateHead'] = git(v['WT'], 'rev-parse', 'HEAD')
            row['candidateTree'] = git(v['WT'], 'rev-parse', 'HEAD^{tree}')
            row['integrationStatus'] = git(v['MAIN'], 'status', '--porcelain=v1', '--untracked-files=all')
            row['integrationHead'] = git(v['MAIN'], 'rev-parse', 'HEAD')
            row['integrationTree'] = git(v['MAIN'], 'rev-parse', 'HEAD^{tree}')
            row['refs'] = dict(x.split(' ',1)[::-1] for x in git(v['MAIN'], 'for-each-ref', '--format=%(objectname) %(refname)').splitlines())
            row['baseRef'] = git(v['MAIN'], 'rev-parse', v['BASE'])
            row['archiveSHA'] = git(v['WT'], 'rev-parse', v['ARCHIVE'])
    row['guard']=guard_observation(v)
    if s is None:
        require(row['guard']['hostAvailableBytes']>=LAUNCH_MINIMUM_BYTES,'Host below %d GiB launch threshold' % (LAUNCH_MINIMUM_BYTES//1024**3))
        require(not guard_violations(row),'Prelaunch host/storage/Docker guard refused')
    with (Path(v['E']) / 'resource-progress.jsonl').open('a') as f:
        f.write(json.dumps(row) + '\n'); f.flush()
    return row

def violations(v, s, d, base, row):
    bad = guard_violations(row)
    keys = ('max', 'oom', 'oom_kill', 'oom_group_kill')
    for key in ('unit', 'slice'):
        r = row.get(key, {})
        if r.get('systemctlExit')!=0:bad.append(dict(systemdInstrumentationFailure=key))
        events = counters(r.get('memory.events', ''))
        start = counters(base['slice'].get('memory.events', '')) if key == 'slice' else {}
        if any(events.get(k, 0) - start.get(k, 0) > 0 for k in keys) or any(events.get(k,0)<start.get(k,0) for k in start):
            bad.append(dict(scope=key, events=events, baseline=start))
        if r.get('systemd',{}).get('ActiveState') in ('active','activating','deactivating') and 'memory.events' not in r:
            bad.append(dict(observerMissingCounters=key))
        value = real(r)
        if value is not None and value >= GATE_MEMORY_MAX_BYTES:
            bad.append(dict(scope=key, realBytes=value))
    sample = dict(x.split('=', 1) for x in row.get('boundedSample', '').splitlines() if '=' in x)
    if int(sample.get('real_peak', 0)) >= GATE_MEMORY_MAX_BYTES:
        bad.append(dict(realPeak=sample['real_peak']))
    if row.get('integrationStatus') or row.get('candidateStatus') or row['candidateHead'] != d['SQUASHED'] or row['integrationHead'] not in (v['BASE'], d['SQUASHED']) or row['candidateTree'] != v['TREE'] or row['archiveSHA'] != v['REVIEWED']:
        bad.append(dict(unexpectedIdentity=row))
    if row.get('integrationHead') == d['SQUASHED'] and row.get('integrationTree') != v['TREE']:
        bad.append(dict(integrationTree=row.get('integrationTree')))
    for scope, expected in [('slice',dict(MemoryMax=str(20*1024**3),MemoryHigh=str(18*1024**3),MemorySwapMax='0',CPUQuotaPerSecUSec='8s',TasksMax='2048')), ('unit',dict(MemoryMax=str(GATE_MEMORY_MAX_BYTES),MemoryHigh='infinity',MemorySwapMax='0',CPUQuotaPerSecUSec='6s',TasksMax='1024',CPUWeight='20',Nice='10',Restart='no',LimitCORE='0',TimeoutStopUSec='5min'))]:
        props=row.get(scope,{}).get('systemd',{})
        if props.get('ActiveState') in ('active','activating','deactivating'):
            wrong={k:dict(expected=x,actual=props.get(k)) for k,x in expected.items() if props.get(k)!=x}
            if wrong:
                bad.append(dict(scope=scope,capMismatch=wrong))
    protected = load(Path(v['E'])/'protected-refs.json')
    allowed = {v['ARCHIVE']:[v['REVIEWED']], 'refs/heads/'+v['BR']:[d['SQUASHED']], 'refs/heads/'+v['FEATURE']:[v['BASE'],d['SQUASHED']]}
    for ref, expected in protected.items():
        if row['refs'].get(ref) not in allowed.get(ref,[expected]):
            bad.append(dict(protectedRef=ref,before=expected,after=row['refs'].get(ref)))
    # Capture result/status as well as memory recurrence; preserve canonical failure.
    if row.get('unit', {}).get('systemd', {}).get('Result') in ('oom-kill', 'signal', 'core-dump', 'resources'):
        bad.append(dict(unitResult=row['unit']['systemd']))
    return bad

def integrity_binding(v):
    return {k:v[k] for k in ('BUNDLE','E','LABEL','WT','REVIEWED','TREE','BASE')}

def run_integrity_checks(v):
    """The same complete integrity chain, off the observation path."""
    phases=[]
    for name,check in [('preflight',lambda:preflight('monitor',values=v)),
                       ('authorization',lambda:__import__('gate_core').authorization(v)),
                       ('control',lambda:execution_control(v,step='observe')),
                       ('snapshot',lambda:snapshot(v))]:
        started=time.monotonic();cpu=time.process_time()
        try:check()
        except Exception as exc:
            return dict(passed=False,binding=integrity_binding(v),phase=name,error=str(exc),phases=phases)
        phases.append(dict(phase=name,wallSeconds=time.monotonic()-started,cpuSeconds=time.process_time()-cpu))
    return dict(passed=True,binding=integrity_binding(v),phases=phases)

def start_integrity(v):
    # One process, in the caller's bounded cgroup/reservation. Its own group
    # lets shutdown reap an outstanding Git subprocess as well as Python.
    return subprocess.Popen([sys.executable,'-B',str(Path(__file__).resolve()),'--integrity-worker'],
                            stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)

def integrity_output(process,timeout=None):
    """Collect the process pipes once, including when cleanup follows a read."""
    if not hasattr(process,'_integrity_output'):
        process._integrity_output=process.communicate(timeout=timeout)
    return process._integrity_output

def read_integrity(process,v):
    output,_=integrity_output(process,timeout=4)
    try:result=json.loads(output)
    except (ValueError,TypeError):raise RuntimeError('Integrity worker returned no valid result')
    require(result.get('binding')==integrity_binding(v),'Integrity worker binding changed')
    require(process.returncode==0 and result.get('passed') is True,'Integrity worker failed: '+str(result.get('error','unknown')))
    return result

def stop_integrity(process):
    if process is None or getattr(process,'_integrity_closed',False):return
    # Even a completed parent may have left members of its owned group.
    try:os.killpg(process.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:integrity_output(process,timeout=5)
    except subprocess.TimeoutExpired:
        try:os.killpg(process.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        integrity_output(process,timeout=5)
    process._integrity_closed=True

def run_monitor_loop(v,s,d,base,launch_integrity=start_integrity):
    """Observe continuously while one full check runs; never accept a partial check."""
    e=Path(v['E'])
    require('memory.events' in base['slice'], 'Missing slice baseline; stop for parent inspection')
    run = Path(v['ORCH']) / 'bounded' / s['invocationId']
    window_end=time.monotonic()+10800
    process=None;stage='periodic';terminal_seen=False;terminal_verified=False;stopped=False;passes=0
    try:
        process=launch_integrity(v)
        for tick in range(10800):
            if time.monotonic()>=window_end:break
            row=observe(v,s);bad=violations(v,s,d,base,row)
            terminal_seen=terminal_seen or (run/'receipt.json').exists()
            if process is not None and process.poll() is not None:
                try:
                    result=read_integrity(process,v);passes+=1
                    with (e/'integrity-progress.jsonl').open('a') as f:
                        f.write(json.dumps(dict(at=now(),stage=stage,**result))+'\n');f.flush()
                    terminal_verified=stage=='terminal'
                except Exception as exc:bad.append(dict(inputMismatch=str(exc)))
                finally:stop_integrity(process);process=None
            if bad and not stopped:
                save(e/'stop-reason.json',dict(at=now(),violations=bad,invocation=s));stopped=True
                guard_command(['systemctl','--user','stop','--no-block',s['unit']])
                stop_integrity(process);process=None
            if terminal_seen and (stopped or terminal_verified):
                require(stopped or passes>0,'No completed integrity proof')
                print((run/'receipt.json').read_text(),flush=True)
                return
            if process is None and not stopped:
                stage='terminal' if terminal_seen else 'periodic'
                process=launch_integrity(v)
            if row.get('unit',{}).get('systemd',{}).get('ActiveState') in ('inactive','failed','') and not terminal_seen:
                raise RuntimeError('No canonical receipt and unit unavailable; inspect same ID; NO RETRY')
            if tick%50==0:
                print(json.dumps(dict(at=row['at'],invocationId=s['invocationId'],integrityStage=stage,integrityPending=process is not None,integrityPasses=passes,stopped=stopped)),flush=True)
            time.sleep(1)
        raise RuntimeError('Monitoring window ended; preserve same ID; NO RETRY')
    except BaseException as exc:
        if not (e/'observer-failure.json').exists():
            save(e/'observer-failure.json',dict(at=now(),error=str(exc),invocation=s))
        if not (run/'receipt.json').exists():guard_command(['systemctl','--user','stop','--no-block',s['unit']])
        raise
    finally:stop_integrity(process)

def main():
    v=env();e=Path(v['E'])
    if (e/'stop-reason.json').exists():raise StoppedEvidence('Stopped evidence cannot be monitored again')
    s=submission(v)  # Validates the durable invocation and exact-tree mapping once.
    d=mapping(v)
    run_monitor_loop(v,s,d,load(e/'resource-baseline.json'))

if __name__ == '__main__':
    if sys.argv[1:]==['--integrity-worker']:
        signal.signal(signal.SIGTERM,lambda *_:sys.exit(143))
        try:result=run_integrity_checks(env())
        except Exception as exc:result=dict(passed=False,error=str(exc))
        print(json.dumps(result),flush=True);sys.exit(0 if result.get('passed') is True else 1)
    try:
        main()
    except StoppedEvidence as exc:
        print(str(exc),file=sys.stderr);sys.exit(64)
    except Exception as exc:
        v = env(); e = Path(v['E']); s = submission(v)
        if not (e/'observer-failure.json').exists():
            save(e/'observer-failure.json', dict(at=now(), error=str(exc), invocation=s))
        if not (Path(v['ORCH'])/'bounded'/s['invocationId']/'receipt.json').exists():
            subprocess.run(['systemctl','--user','stop','--no-block',s['unit']], check=True)
        raise
