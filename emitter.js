import { EventEmitter } from 'events';

class ScanEmitter extends EventEmitter {}

export const scanEmitter = new ScanEmitter();
