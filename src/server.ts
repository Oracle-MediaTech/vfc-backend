import "./bootstrap/env";
import App from './app';
import {
  IndexRoute,
  UserRoute,
  AttendanceRoute,
  AuthRoute,
  InvoiceRoute,
  DepartmentRoute,
  SettingsRoute,
  ServiceDayRoute,
  SpecialProgramRoute,
  RbacRoute
} from './core/routes';
import { validateEnv } from './core/utils/validateEnv';

validateEnv();

const app = new App([
  new UserRoute(),
  new AuthRoute(),
  new AttendanceRoute(),
  new InvoiceRoute(),
  new DepartmentRoute(),
  new SettingsRoute(),
  new ServiceDayRoute(),
  new SpecialProgramRoute(),
  new RbacRoute(),
  new IndexRoute()
]);

app.listen();