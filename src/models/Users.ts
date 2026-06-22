import mongoose, { Schema } from "mongoose";
import { User } from "types/UserTypes";
import bcrypt from "bcrypt";

const UserSchema: Schema = new Schema<User>(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: "Roles",
      },
    ],
    subscription: {
      transactionId: { type: String },
      paymentDate: { type: Date },
      expirationDate: { type: Date },
    },
    communityBonusGrantedAt: { type: Date },
    couponUsed: { type: Boolean, default: false },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 280 },
    nationality: {
      type: String,
    },
    locality: {
      type: String,
    },
    age: {
      type: Number,
    },
    // Nuevos campos para capacitaciones:
    capSeresArte: { type: Boolean, default: false },
    capThr: { type: Boolean, default: false },
    capPhr: { type: Boolean, default: false },
    capMat: { type: Boolean, default: false },
    capUor: { type: Boolean, default: false },
    capReh: { type: Boolean, default: false },
    capViv: { type: Boolean, default: false },
    capTELA: { type: Boolean, default: false },
    capNO_CONVENCIONAL: { type: Boolean, default: false },
    capDANZA_DRAGON: { type: Boolean, default: false },
    capPARADA_MANOS: { type: Boolean, default: false },
    capDANZA_AEREA_ARNES: { type: Boolean, default: false },
    capCUBO: { type: Boolean, default: false },
    capPOLE_AEREO: { type: Boolean, default: false },
    capRED: { type: Boolean, default: false },
    capCONTORSION: { type: Boolean, default: false },
    capARO: { type: Boolean, default: false },
    capACRO_TRAINING: { type: Boolean, default: false },
    capANCESTROS_AL_DESCUBIERTO: { type: Boolean, default: false },

    // Nuevos campos para recuperación de contraseña
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

UserSchema.pre<User>("save", async function (next) {
  if (this.isModified("password") || this.isNew) {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(this.password, salt);
    this.password = hash;
  }
  next();
});

UserSchema.method(
  "comparePassword",
  async function (password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password as string);
  }
);

UserSchema.methods.toJSON = function () {
  const userObj = this.toObject();
  delete userObj.password;
  return userObj;
};

export const UserModel = mongoose.model<User>("User", UserSchema);
