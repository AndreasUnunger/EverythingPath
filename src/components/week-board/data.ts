import { militiaEventTable } from '~/lib/militia-event-table';
import type {
  ActionCard,
  MilitiaEventDetails,
  MilitiaEventEntry,
  WeekPhase,
} from '~/components/week-board/types';

export const ACTION_CARDS: ActionCard[] = [
  {
    id: 'activate_black_market',
    title: 'Activate Black Market',
    team: 'Black Marketeers',
    cost: '50 gp',
    fullText: [
      'Check: DC 20 Secrecy.',
      'Success: black market active 1 week; availability rises to 90%; sold magic items return 55% value.',
      'Failure: Notoriety +1d6.',
    ],
  },
  {
    id: 'activate_refuge',
    title: 'Activate Refuge',
    team: 'Conspirators / Scholars / Spellcasters',
    cost: '1 action',
    fullText: [
      'In hostile or unfriendly settlement, treat reputation as one step better while active.',
      'Refuge lasts 1 week and can be renewed.',
    ],
  },
  {
    id: 'broker_market',
    title: 'Broker Market',
    team: 'Black Marketeers / Fixers / Merchants',
    cost: '100 gp',
    fullText: [
      'Creates temporary market source.',
      'Items are paid on activation and arrive next Activity phase.',
    ],
  },
  {
    id: 'change_officer_role',
    title: 'Change Officer Role',
    team: 'No Team Required',
    cost: '1 action',
    fullText: [
      'No team required; consumes one Activity action.',
      'One PC changes officer role.',
    ],
  },
  {
    id: 'covert_action',
    title: 'Covert Action',
    team: 'Spies',
    cost: '1 action',
    fullText: [
      'Option 1: augment immediately following militia action with spies manager Charisma bonus to all d20 rolls.',
      'If augmented action succeeds, it does not increase Notoriety.',
      'Option 2: place contact/cache in specific adventure site for 1 week.',
    ],
  },
  {
    id: 'dismiss_team',
    title: 'Dismiss Team',
    team: 'No Team Required',
    cost: '1 action',
    fullText: [
      'Check: DC 10 Loyalty.',
      'Success: remove one team and free slot.',
      'Failure: Notoriety +1d6.',
    ],
  },
  {
    id: 'drill_militia',
    title: 'Drill Militia',
    team: 'No Team Required',
    cost: 'minimum treasury value',
    fullText: [
      'No team required; once per Activity phase.',
      'Check: Loyalty vs 10 + rank.',
      'Success: training +2d6 plus Commandant bonuses.',
    ],
  },
  {
    id: 'earn_gold',
    title: 'Earn Gold',
    team: 'Black Marketeers / Fixers / Merchants / Patrons',
    cost: '1 action',
    fullText: [
      'Check: Loyalty.',
      'Gold gained: check result x team tier gp.',
      'Natural 1: still gain gold, but Notoriety +1d6.',
    ],
  },
  {
    id: 'gather_information',
    title: 'Gather Information',
    team: 'Conspirators / Informants / Scholars / Spellcasters',
    cost: '1 action',
    fullText: [
      'Check: DC 15 Secrecy with bonus +2 x team tier.',
      'Success yields rumor/location/person/settlement intelligence as GM allows.',
      'Natural 1: Notoriety +1d6.',
    ],
  },
  {
    id: 'guarantee_event',
    title: 'Guarantee Event',
    team: 'No Team Required',
    cost: 'minimum treasury value + Notoriety +1d6',
    fullText: [
      'Event is guaranteed this week.',
      'GM rolls twice; PCs choose which event occurs.',
    ],
  },
  {
    id: 'knowledge_check',
    title: 'Knowledge Check',
    team: 'Scholars',
    cost: '1 action',
    fullText: [
      'Roll Secrecy check + militia rank.',
      'Total is treated as achieved Knowledge DC.',
      'Can identify magic items and evaluate monsters/NPC abilities.',
    ],
  },
  {
    id: 'reduce_danger',
    title: 'Reduce Danger',
    team: 'Defenders / Guardians / Infiltrators / Specialists',
    cost: '1 action',
    fullText: [
      'Check: DC 15 Security.',
      'Success: temporary +1 reputation step for week in target town.',
      'Failure: Notoriety +1d4.',
    ],
  },
  {
    id: 'manipulate_events',
    title: 'Manipulate Events',
    team: 'Guardians',
    cost: '1 action',
    fullText: [
      'Guarantees an event this week.',
      'GM rolls twice on event table.',
      'Guardians manager (or random PC) chooses which event occurs.',
    ],
  },
  {
    id: 'recruit_team',
    title: 'Recruit Team',
    team: 'No Team Required',
    cost: '1 action',
    fullText: [
      'Requires free non-bonus team slot.',
      'Uses team-specific recruitment check and DC.',
      'Natural 1: no auto-fail, but Notoriety +1d6.',
    ],
  },
  {
    id: 'rescue_character',
    title: 'Rescue Character',
    team: 'Guardians / Infiltrators / Specialists',
    cost: '1 action',
    fullText: [
      'Check: Security vs 10 + captured character level.',
      'Success: captured PC/NPC recovered.',
      'Failure: character not rescued; Notoriety still increases.',
    ],
  },
  {
    id: 'restore_character',
    title: 'Restore Character',
    team: 'Spellcasters',
    cost: '1 action',
    fullText: [
      'Party-scale restoration options or paid single-target restorative effects.',
      'Body/target must be at militia location or activated refuge.',
    ],
  },
  {
    id: 'secure_cache',
    title: 'Secure Cache',
    team: 'Moles / Propagandists / Saboteurs / Spies',
    cost: '1 action',
    fullText: [
      'Place or retrieve hidden supplies.',
      'Cache class and secure-location DC rules apply.',
      'Failure to place returns cache next Activity phase.',
    ],
  },
  {
    id: 'special',
    title: 'Special',
    team: 'No Team Required',
    cost: 'GM-defined',
    fullText: ['GM-defined story or event resolution action.'],
  },
  {
    id: 'special_order',
    title: 'Special Order',
    team: 'Fixers',
    cost: 'item cost',
    fullText: [
      'Place order for specific item at 5% discount.',
      'Delivery time: 2d6 days; expedited 1 day for +900 gp.',
      'Can arrange enchantment on existing magic item.',
    ],
  },
  {
    id: 'spread_propaganda',
    title: 'Spread Propaganda',
    team: 'Propagandists / Saboteurs / Spies',
    cost: '100 gp',
    fullText: [
      'Check: DC 20 Loyalty.',
      'Success: improve settlement reputation by one step.',
      'Settlement can be influenced once per Activity phase.',
    ],
  },
  {
    id: 'strike_team',
    title: 'Strike Team',
    team: 'Specialists',
    cost: '1 action',
    fullText: [
      'Choose target location when action is taken.',
      'At that location next week: +2 competence to attack, damage, and saves for rounds equal to half militia rank.',
      'Alternate use supports casualty extraction and gentle repose handling.',
    ],
  },
  {
    id: 'upgrade_team',
    title: 'Upgrade Team',
    team: 'No Team Required',
    cost: 'listed upgrade cost',
    fullText: [
      'Spend listed upgrade cost.',
      'Any number can be upgraded in a week if actions and gold allow.',
      'Each specific team can be upgraded at most once per week.',
    ],
  },
  {
    id: 'lie_low',
    title: 'Lie Low',
    team: 'No Team Required',
    cost: 'all actions',
    fullText: [
      'Must be the only action taken this Activity phase.',
      'Notoriety decreases by total number of teams.',
    ],
  },
];

export const WEEK_PHASES: WeekPhase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'week_closed',
];

export const MILITIA_EVENT_TABLE: MilitiaEventEntry[] = militiaEventTable;

export const MILITIA_EVENT_DETAILS: Record<string, MilitiaEventDetails> = {
  'All Is Calm': {
    fullText: [
      'No event this week.',
      'Twice: next week skip event-chance roll and apply this outcome directly; this does not build the uneventful bonus chain.',
    ],
  },
  'Broke the Code': {
    fullText: [
      'Identify one magic item of any caster level.',
      'PCs gain +2 Knowledge (local) for week.',
      'Twice: bonus becomes +5.',
    ],
  },
  'Cache Discovered': {
    fullText: [
      'Lose one hidden/planned cache and contents.',
      'Mitigate: Secrecy check DC 10 + rank to retrieve.',
      'Twice: all caches discovered.',
    ],
  },
  'Calm before the Storm': {
    fullText: [
      'No event now.',
      'Next week: roll event table and apply that event automatically (ignore Roll Twice result), then continue with normal Event phase roll.',
      'This week does not count as uneventful for rank bonus purposes.',
      'Twice: next week roll two automatic events (ignore all Roll Twice), then run Event phase normally.',
    ],
  },
  'Double Agent': {
    fullText: [
      'Cannot use Secure Cache next Activity phase.',
      'Secrecy checks suffer -2 penalty.',
      'Twice: becomes persistent.',
    ],
  },
  Festival: {
    fullText: [
      'Choose recently used town.',
      'PCs gain +2 morale to Bluff/Diplomacy/Intimidate there for week.',
      'Twice: bonus becomes +5.',
    ],
  },
  'Found Fire': {
    fullText: [
      'Each PC gets one non-poison alchemical item worth <=100 gp.',
      'Security checks gain +2 for upcoming week.',
      'Twice: choose one additional <=100 gp item.',
    ],
  },
  'Hidden Agenda': {
    fullText: [
      'Militia gains +2 on all Activity phase checks this week.',
      'Twice: bonus becomes +5.',
    ],
  },
  'High Morale': {
    fullText: [
      'End one current persistent event immediately.',
      'Loyalty checks gain +2 for upcoming week.',
      'Twice: end two persistent events and bonus becomes +5.',
    ],
  },
  Invasion: {
    fullText: ['GM presents random combat encounter at CR APL + 1.'],
  },
  'Low Morale': {
    fullText: ['Loyalty checks suffer -2.', 'Twice: becomes persistent.'],
  },
  'Market Day': {
    fullText: [
      'One operated town (PC choice): all items/services gain extra 5% discount.',
      'Twice: applies to all operated marketplaces, including Broker Market marketplaces.',
    ],
  },
  'Missing in Action': {
    fullText: [
      'One random team that operated this week is unavailable next week.',
      'Twice: team returns end of following week, but disabled.',
    ],
  },
  'Night Ops': {
    fullText: [
      'PCs gain +2 circumstance bonus to Stealth after dark for week.',
      'Twice: bonus becomes +5.',
    ],
  },
  Raid: {
    fullText: [
      'In random settlement with active refuge(s), all refuges deactivate.',
      'Hidden persons may be captured and can be recovered next week via Rescue Character (DC 5 + rank).',
      'Mitigate: DC 20 Security per person to reduce capture chance by 50%.',
    ],
  },
  Rivalry: {
    fullText: [
      'Two random teams cannot act next Activity phase.',
      'Twice: persistent until officer succeeds at DC 20 Bluff, Diplomacy, or Intimidate.',
    ],
  },
  'Roll Twice': {
    fullText: [
      'Roll and resolve two events.',
      'Roll Twice can only take effect once per Event phase.',
      'Additional Roll Twice results in same phase are rerolled.',
    ],
  },
  Sickness: {
    fullText: [
      'One random team becomes disabled.',
      'Twice: team is lost unless militia succeeds on DC 20 Loyalty.',
    ],
  },
  Theft: {
    fullText: [
      'Militia treasury is halved.',
      'Mitigate: DC 20 Loyalty reduces loss to 10% instead.',
      'Twice: becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.',
    ],
  },
  'Turn Around': {
    fullText: [
      'All disabled teams recover.',
      'If none disabled, one team gains +2 on one check next Activity phase.',
    ],
  },
  Turncoat: {
    fullText: [
      'Training decreases by 1d6 + rank.',
      'Twice: one full team defects (GM choice) unless officer succeeds at Diplomacy DC 10 + rank; even on success team is unavailable next Activity phase.',
    ],
  },
  'War Games': {
    fullText: ['Training increases by rank.'],
  },
  'Week of Pain': {
    fullText: [
      'Next week: -1 penalty to all organization checks.',
      'Next Upkeep training loss is doubled.',
      'Twice: no additional effect.',
    ],
  },
  'Week of Serenity': {
    fullText: [
      'Next week: +5 bonus to all organization checks.',
      'Next Activity training gain is doubled.',
      'Twice: no additional effect.',
    ],
  },
};
