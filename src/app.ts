import compression from 'compression';
import http, { Server } from "http";
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import path from 'path'
const socket = require('socket.io')
import morgan from 'morgan';
import {
  NODE_ENV, HOST, PORT, LOG_FORMAT, DB_URI
} from './config';
import { dbConnection } from './core/databases';
import { engine } from 'express-handlebars';
import { Routes } from './core/routes/interfaces/RouteInterface';
import { logger, stream, registerShutdownHandler } from './core/utils';
import { globalErrorHandler } from './core/middlewares/ErrorMiddleware';
import { spaFallback } from './core/middlewares/SpaMiddleware';
import Handlebars from 'handlebars'



declare let require: any;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      io: Server<any>
    }
  }
}

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;
  public io: any;
  // public io: SocketIO.Server

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = 'production'; NODE_ENV || 'development';
    this.port = PORT || 3000;

    this.connectDatabase()
    // this.initSocket()
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSpaRoutes();
    this.initializeErrorHandling();
    // this.handleViews();
  }

  public listen() {
    logger.info('Starting Server ....')

    const server = this.createServer();

    // const io = socket(server, {
    //   cors: {
    //     origin: "*",
    //     // methods: ["GET", "POST"]
    //   },
    // });

    server.setTimeout(500000);

    // global.io = io; // Make the io instance globally accessible

    // const chatService = new ChatSocketService(io);

    // logger.info('========================== Connecting socket ================================');
    // io.on('connection', (socket) => {
    //   logger.info('========================== socket io connected! ================================');

    //   chatService.setupChatListeners(socket);

    //   // You can set up additional socket event listeners here, e.g., for progress updates
    //   socket.on('disconnect', () => {
    //     logger.info('Client disconnected');
    //   });
    // });

    server.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`========= SERVER 🚀=======`);
      logger.info(`========= ENV: ${this.env} ========`);
      logger.info(`========= PORT: ${this.port} ========`);
      logger.info(`🚀 Server running on  ${HOST}:${this.port} 🚀`);
      logger.info(`=================================`);

    });

    return server
  }

  // handleViews() {
  //   // Set Handlebars as the view engine
  //   this.app.engine('handlebars', engine());
  //   this.app.set('view engine', 'handlebars');
  //   this.app.set('views', './views'); // Folder where your views will be stored
  //   Handlebars?.registerHelper('ifEquals', function (arg1, arg2, options) {
  //     return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
  //   });
  // }

  public createServer() {
    return http.createServer(this.app)
  }

  public getServer() {
    return this.app;
  }

  private async connectDatabase() {
    // if (this.env !== 'production') {
    //   set('debug', true);
    // }

    // return new Promise((resolve, reject) => {
    //   connect(
    //     dbConnection.url,
    //     dbConnection.options as ConnectOptions,
    //     (error: NativeError) => {
    //       if (error) {
    //         logger.error(`Database Error: ${error}`)
    //         reject(error)
    //       } else {
    //         logger.info(`=================================`);
    //         logger.info(`========= DATABASE 🚀=======`);
    //         logger.info(`🚀 Database running on ${DB_URI} 🚀`);
    //         logger.info(`=================================`);

    //         resolve(undefined)
    //       }
    //     },
    //   )
    // })

    //implemnt prisma db connection

  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));
    this.app.use(cors({ origin: '*' }));
    this.app.use(hpp());
    this.app.use(helmet({
      hsts: false,
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
    }));
    this.app.use(compression());
    this.app.use(express.json({ limit: "15mb" }));
    this.app.use(express.urlencoded({ limit: "15mb", extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));

    this.app.use(cookieParser());
  }

  private initializeRoutes(routes: Routes[]) {
    logger.info('Initializing Routes ....')

    routes.forEach(route => {
      this.app.use('/api/v1', route.router);
    });


    logger.info('Routes Initialized Successfully ✔️')

  }

  private stopServer(): Promise<void> {
    logger.info('Stopping HTTP Server ❌')

    return new Promise((resolve, reject) => {
      this.listen().close(error => {
        if (error) {
          reject(error)
        } else {
          resolve(undefined)
        }
      })
    })
  }


  private initializeSpaRoutes() {
    logger.info('Initializing SPA Routes ....');

    // Terminal: static files + SPA fallback
    this.app.use('/terminal', express.static(path.resolve(process.cwd(), 'public/terminal')));
    this.app.use('/terminal', spaFallback('terminal'));


    // Admin: static files + SPA fallback
    this.app.use(express.static(path.resolve(process.cwd(), "public/home")));
    // this.app.use(spaFallback('admin'));

    logger.info('SPA Routes Initialized Successfully');
  }

  private initializeErrorHandling() {
    logger.info('Initializing Error Handler ....')

    this.app.use(globalErrorHandler);

    registerShutdownHandler(this.stopServer)

    logger.info('Error Handler Initialized Successfully ✔️')

  }

}

export default App;
