import { log } from "console";
import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on("connected", async () => {
            console.log('MongoDB Connected')
        });
        await mongoose.connect(process.env.MONOGODB_URI!)
    } catch (error: any) {
        console.error(error);
        process.exit(1);

    }
}


export default connectDB;