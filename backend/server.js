import express from "express";
import { MongoClient } from "mongodb";
import { crowdfunding, provider } from "./blockchain.js";

if (!process.env.MONGODB_URI) {
  throw new Error("Thiếu MONGODB_URI trong file .env");
}

const app = express();
const port = Number(process.env.PORT || 3001);

const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});

const db = client.db(process.env.MONGODB_DB || "crowdfunding");

app.use(express.json());

// API kiểm tra database có đang phản hồi hay không.
app.get("/api/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/campaigns", async (_req, res) => {
  try {
    const campaigns = await db
      .collection("campaigns")
      .find({})
      .limit(20)
      .toArray();

    res.json(campaigns);
  } catch {
    res.status(500).json({
      error: "Không đọc được danh sách chiến dịch.",
    });
  }
});

app.get("/api/blockchain/campaign-count", async (_req, res) => {
  try {
    const network = await provider.getNetwork();

    if (network.chainId !== 11155111n) {
      return res.status(503).json({
        error: "RPC đang kết nối sai mạng Sepolia.",
      });
    }

    const count = await crowdfunding.campaignCount();

    res.json({
      chainId: Number(network.chainId),
      contractAddress: process.env.CROWDFUNDING_ADDRESS,
      campaignCount: count.toString(),
    });
  } catch {
    res.status(503).json({
      error:
        "Chưa đọc được contract Sepolia. Kiểm tra RPC và địa chỉ contract.",
    });
  }
});

app.post("/api/campaigns/sync", async (req, res) => {
  const id = req.body?.campaignId;

  // Dùng chuỗi để giữ chính xác cả ID lớn.
  if (
    typeof id !== "string" ||
    !/^[1-9]\d{0,77}$/.test(id) ||
    BigInt(id) >= 2n ** 256n
  ) {
    return res.status(400).json({
      error: "campaignId phải là chuỗi số nguyên dương hợp lệ.",
    });
  }

  try {
    const network = await provider.getNetwork();

    if (network.chainId !== 11155111n) {
      return res.status(503).json({
        error: "RPC đang kết nối sai mạng Sepolia.",
      });
    }

    const block = await provider.getBlock("latest");

    if (!block) {
      return res.status(503).json({
        error: "Chưa đọc được block Sepolia.",
      });
    }

    const campaign = await crowdfunding.getCampaign(id, {
      blockTag: block.number,
    });

    const contractAddress = (await crowdfunding.getAddress()).toLowerCase();

    const record = {
      chainId: 11155111,
      contractAddress,
      campaignId: id,
      owner: campaign.owner,
      title: campaign.title,
      description: campaign.description,
      goalWei: campaign.goal.toString(),
      deadlineSeconds: campaign.deadline.toString(),
      totalRaisedWei: campaign.totalRaised.toString(),
      totalRefundedWei: campaign.totalRefunded.toString(),
      withdrawn: campaign.withdrawn,
      syncedBlock: block.number,
      syncedAt: new Date(),
    };

    await db
      .collection("campaigns")
      .updateOne(
        { _id: `11155111:${contractAddress}:${id}` },
        { $set: record },
        { upsert: true },
      );

    res.json({
      ok: true,
      campaign: record,
    });
  } catch (error) {
    if (error.code === "CALL_EXCEPTION") {
      return res.status(404).json({
        error: "Không đọc được chiến dịch. Kiểm tra ID trên contract Sepolia.",
      });
    }

    res.status(503).json({
      error: "Chưa đồng bộ được. Kiểm tra kết nối MongoDB và Sepolia.",
    });
  }
});
// Chỉ mở server sau khi kết nối database thành công.
try {
  await client.connect();
  await db.command({ ping: 1 });

  console.log("Đã kết nối MongoDB Atlas");

  app.listen(port, "127.0.0.1", () => {
    console.log(`Backend: http://localhost:${port}`);
  });
} catch {
  console.error(
    "Không kết nối được Atlas. Kiểm tra URI, database user và Network Access.",
  );
  await client.close();
  process.exitCode = 1;
}
