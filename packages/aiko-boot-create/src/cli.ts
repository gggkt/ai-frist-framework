#!/usr/bin/env node
/**
 * aiko-boot-create CLI
 * Create a new aiko-boot scaffold project (monorepo: api, admin, mobile, shared, core).
 */
import { createCommand } from './create.js';

createCommand();
