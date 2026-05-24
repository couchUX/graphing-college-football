import type { Detector } from './types';
import { closeSPGamesDetector } from './closeSPGames';
import { efficientLosersDetector } from './efficientLosers';
import { topExcitementDetector } from './topExcitement';
import { havocVsSPDetector } from './havocVsSP';
import { returningProductionDetector } from './returningProduction';
import { teamPPADetector } from './teamPPA';

export const detectors: Detector[] = [
  closeSPGamesDetector,
  efficientLosersDetector,
  topExcitementDetector,
  havocVsSPDetector,
  returningProductionDetector,
  teamPPADetector,
];
