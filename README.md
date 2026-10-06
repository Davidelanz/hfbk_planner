# HFBK Course Planner

A bilingual course planner with list, month, week, conflict, and missing-information views. Everything runs in the browser. Course data is not sent to a server.

This is an independent project and is not an official HFBK service.

## Features

- English and German course descriptions
- Collapsible course, subject, and course-type sections
- Monthly and hourly weekly calendars
- Subject colours, saved filters, plan status, and registration status
- Conflict ranking for selected courses
- JSON import and export

## Start the development server

Docker is the only requirement.

```sh
docker run --rm -it \
  -p 4173:4173 \
  -v "$PWD:/app" \
  -v /app/node_modules \
  -w /app \
  node:22-alpine \
  sh -lc "npm ci && npm run dev -- --port=4173"
```

Open <http://localhost:4173>.

## Add course data

Copy [data.example.json](data.example.json) to `data/data.json`, then replace the example course with your own entries. The `data/` directory is ignored by Git.

You can also open **How to upload data** in the app and choose a JSON file. A JSON file is a text document with labelled fields for information such as titles, dates, rooms, and teachers.

Imported data stays in the current browser session. Plan and registration choices are stored in local browser storage. Export the JSON if you want to keep those changes in a file.

## Build

```sh
./build.sh
```

The static site is written to `dist/`. Production builds never include `data/data.json`. Visitors provide their own file through the upload view.

## Code quality

The build script runs formatting checks, ESLint, TypeScript, and the production build. Run the checks without building with:

```sh
docker run --rm -v "$PWD:/app" -v /app/node_modules -w /app node:22-alpine \
  sh -lc "npm ci && npm run check"
```

Format the source with the same container command, replacing `npm run check` with `npm run format`.

## Publishing

The GitHub Pages workflow builds the static application and deploys `dist/`. It does not publish personal course data.

## License

[MIT](LICENSE)
