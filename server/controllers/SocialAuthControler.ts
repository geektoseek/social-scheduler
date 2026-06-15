import { Request, Response } from "express";
import zernio from "../config/zernio.js";
import { User } from "../models/User.js";
import { brotliDecompressSync } from "node:zlib";
import { json } from "node:stream/consumers";
import { url } from "node:inspector";
import { Account } from "../models/account.js";
// Helper to ensure user has a Zernio Profile.
const getOrCreateZernioProfile = async (user: any): Promise<string> => {
    try {
        const result = await zernio.profiles.listProfiles()
        const data = result.data as any;
        const profiles: any[] = Array.isArray(data) ? data : data?.profiles || data?.data || [];

        if (profiles.length > 0) {
            const pid = profiles[0]._id || profiles[0].id;
            await User.findByIdAndUpdate(user._id, { zernioProfileId: pid })
        }
        const createResult = await zernio.profiles.createProfile({
            body: { name: `${user.name || user.email}'s workspace` } as any,
        })
        const created = (createResult.data as any)?.profiles || createResult.data;
        const pid = created?._id || created?.id;
        if (!pid) {
            throw new Error("Faild to create  zernio profile  -  no ID returned")
        }
        await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
        return pid;
    } catch (error: any) {
        console.error("getOrcreateZernioProfile Error : ", error?.message || error);
        throw error;

    }
}
// Generate OAuth authorization URL
// GET /api/auth/:platform
export const generateAuthUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const { platform } = req.params;
        const profileId = await getOrCreateZernioProfile(req.user);

        const origin = req.headers.origin;
        const redirectUrl = `${origin}/accounts`;

        const result = await zernio.connect.getConnectUrl({
            path: { platform: platform as any },
            query: {
                profileId,
                redirect_url: redirectUrl
            }
        })
        const data = result.data as any;
        console.log("Get Connect URL Response :", JSON.stringify(data, null, 2));
        const authUrl = data.authurl;

        if (!authUrl) {
            throw new Error(`Zernio returned no authurl. Full response:${JSON.stringify(data)} `)
        }
        res.json({ url: authUrl })

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "server error" })

    }
}

//  Sync connected accounts from zernio into MongoDB
//  GET /api/auth/sync


export const syncAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const profileId = await getOrCreateZernioProfile(req.user);
        const result = await zernio.accounts.listAccounts({
            query: { profileId } as any
        })
        const data = result.data as any;
        const zernioAccounts: any[] = data?.accounts || (Array.isArray(data) ? data : []);
        const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];
        const syncedAccounts = [];
        for (const zAccount of zernioAccounts) {
            const zid = zAccount._id || zAccount.id;
            if (!zid) {
                console.warn("Skipping account with no ID:", zAccount);
                continue;
            }
            const rawPlatform = (zAccount.platform || zAccount.type || "").toLowerCase();
            const normalizedPlatform = supportedPlatforms.find((p) => rawPlatform.includes(p));

            if (!normalizedPlatform) {
                console.log(`Skipping account with no ID: "${rawPlatform}"`);
                continue;
            }
            const account = await Account.findOneAndUpdate(
                { zernioAccountId: zid },
                {
                    user: req.user._id,
                    platform: normalizedPlatform,
                    handle: zAccount.userName || zAccount.name || zAccount.handle || "unkown",
                    zernioAccountId: zid,
                    status: "connected"
                }
            )
        }
    } catch (error) {
    }
}