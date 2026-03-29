const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

// 🔗 PUT YOUR GOOGLE SHEET CSV URL HERE
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWvXk38H0qaM5bqptlxE5o8sUezBNs5iyFnDupwBbQr21pcVTEJ03ymVz7ZRXgJGT6rZHuZliLct5T/pub?output=csv";

// In-memory cache
let cache = new Map();

// 🔥 Robust input parsing
function parseInput(input) {
  if (!input) return null;

  input = input.replace(/\s+/g, "").toLowerCase();

  let type = "normal";

  if (input.startsWith("d") || input.startsWith("dis") || input.startsWith("discount")) {
    type = "discount";
  } else if (input.startsWith("w") || input.startsWith("whole") || input.startsWith("wholesale")) {
    type = "wholesale";
  }

  const match = input.match(/\d+/);
  if (!match) return null;

  const sku = match[0];

  const num = parseInt(sku);
  if (num < 101 || num > 999) return null;

  return { sku, type };
}

// 🔄 Load data from Google Sheets
async function loadData() {
  try {
    console.log("Fetching data...");

    const response = await axios.get(SHEET_URL);
    const lines = response.data.split("\n");

    const tempMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");

      if (row.length < 6) continue;

      const sku = row[0]?.trim();
      const name = row[1]?.trim();
      const description = row[2]?.trim();
      const price = row[3]?.trim();
      const discountPrice = row[4]?.trim();
      const wholesalePrice = row[5]?.trim();

      if (!sku) continue;

      tempMap.set(sku, {
        sku,
        name,
        description,
        price,
        discountPrice,
        wholesalePrice
      });
    }

    cache = tempMap;

    console.log(`✅ Cache loaded: ${cache.size} items`);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

// Load on startup
loadData();

// 🔍 Search API
app.get("/api/item", (req, res) => {
  const input = req.query.sku;

  const parsed = parseInput(input);

  if (!parsed) {
    return res.send("No results, search again ❌");
  }

  const { sku, type } = parsed;

  const item = cache.get(sku);

  if (!item) {
    return res.send("No results, search again ❌");
  }

  let finalPrice = item.price;

  if (type === "discount" && item.discountPrice) {
    finalPrice = item.discountPrice;
  } else if (type === "wholesale" && item.wholesalePrice) {
    finalPrice = item.wholesalePrice;
  }

  res.json({
    name: item.name,
    description: item.description,
    price: finalPrice
  });
});

// 🔄 Refresh API
app.post("/api/refresh", async (req, res) => {
  await loadData();
  res.send(`Cache refreshed ✅ Total items: ${cache.size}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});