import express from 'express';
import injectRoutes from "./routes";

const app = express();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`API has started listening at port:${port}`);
});

injectRoutes(app)

export default app;
