import mongoose, { model, Schema } from "mongoose";

const subcriptionSchema = new Schema(
  {
    subcriber: {
      // one who is subcribing
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    channel: {
      //  whom  to subcribe
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subcription = mongoose.model("Subcription", subcriptionSchema);
