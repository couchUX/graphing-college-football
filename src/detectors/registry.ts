import type { Detector } from './types';
import { closeSPGamesDetector } from './closeSPGames';
import { efficientLosersDetector } from './efficientLosers';
import { topExcitementDetector } from './topExcitement';
import { havocVsSPDetector } from './havocVsSP';
import { talentVsSPDetector } from './talentVsSP';
import { returningProductionDetector } from './returningProduction';
import { teamPPADetector } from './teamPPA';
import { topPlayerPPADetector } from './topPlayerPPA';

export const detectors: Detector[] = [
  closeSPGamesDetector,
  efficientLosersDetector,
  topExcitementDetector,
  teamPPADetector,
  topPlayerPPADetector,
  havocVsSPDetector,
  talentVsSPDetector,
  returningProductionDetector,
];
