import { Factory } from 'fishery';
import { XItems } from '../interfaces/redis.interface.js';
import { xItemBufferFactory, xItemStringFactory } from './x-item.factory.js';

export const xItemsStringFactory = Factory.define<XItems>(({ sequence }) => [xItemStringFactory.build()]);

export const xItemsBufferFactory = Factory.define<XItems>(({ sequence }) => [xItemBufferFactory.build()]);
