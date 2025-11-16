import express from "express";
import purchaseRouter from "./routes/purchase.js";

const app = express();
app.use(express.json());

app.use("/api/purchase", purchaseRouter);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening on", process.env.PORT || 3000);
});