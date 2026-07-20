import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { admin } from './admin'
import { authoring } from './authoring'
import { authRoutes } from './auth'
import { children } from './children'
import { classes } from './classes'
import { communities } from './communities'
import { explainer } from './explainer'
import { health } from './health'
import { i18n } from './i18n'
import { knowledge } from './knowledge'
import { media } from './media'
import { orgs } from './orgs'
import { prompts } from './prompts'
import { profile } from './profile'
import { relationships } from './relationships'
import { students } from './students'

/**
 * Root router. Better Auth's own endpoints are mounted separately at
 * /api/auth/* in app.ts; `/auth` here holds our complementary identity routes,
 * `/children` guardian-managed child accounts, `/classes` + `/students` academic
 * scope, `/admin` platform-admin ops.
 */
export const routes = new Hono<AppEnv>()
  .route('/health', health)
  .route('/i18n', i18n)
  .route('/auth', authRoutes)
  .route('/children', children)
  .route('/classes', classes)
  .route('/students', students)
  .route('/orgs', orgs)
  .route('/relationships', relationships)
  .route('/communities', communities)
  .route('/knowledge', knowledge)
  .route('/authoring', authoring)
  .route('/media', media)
  .route('/explainer', explainer)
  .route('/prompts', prompts)
  .route('/', profile)
  .route('/admin', admin)
