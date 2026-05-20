# CraftyRachel

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Local development

1. Copy `.env.example` to `.env`.
2. Set your Neon `DATABASE_URL` and optional `JWT_SECRET`.
3. Run:

```bash
npm install
npm start
```

The backend server listens on port `5000` and serves the Angular app from `dist/crafty-rachel/browser` after build.

## Deployment to Render

This project includes a `render.yaml` for Render free-tier deployment.
Render should run:

```bash
npm install && npm run build
node server/index.js
```

Set the following environment variables in Render:

- `DATABASE_URL` — your Neon/Postgres connection string
- `JWT_SECRET` — a secure random secret for JWT signing
- `NODE_ENV=production`

Do not commit your local `.env` file to Git.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
