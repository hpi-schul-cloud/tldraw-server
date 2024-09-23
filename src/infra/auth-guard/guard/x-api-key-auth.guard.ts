import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StrategyType } from '../interface/index.js';

@Injectable()
export class ApiKeyGuard extends AuthGuard(StrategyType.API_KEY) {}
