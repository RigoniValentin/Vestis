import { UserRepository } from "@repositories/userRepository";
import { UserService } from "@services/userService";
import { IUserRepository, IUserService, User } from "types/UserTypes";
import { Request, Response } from "express";

const userRepository: IUserRepository = new UserRepository();
const userService: IUserService = new UserService(userRepository);

export const findUsers = async (req: Request, res: Response): Promise<void> => {
  console.log("req :>> ", req.currentUser);

  try {
    const users = await userService.findUsers();
    if (users.length === 0) {
      res.status(404).json({ message: "No users found" });
      return;
    }
    res.json(users);
  } catch (error) {
    console.log("error :>> ", error);
    res.status(500).json(error);
  }
};

export const findUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await userService.findUserById(req.params.id as string);
    if (!users) {
      res.status(404).json({ message: "Not user found" });
      return;
    }
    res.json(users);
  } catch (error) {
    console.log("error :>> ", error);
    res.status(500).json(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const newUser: User = req.body;
    const result = await userService.createUser(newUser);
    res.status(201).json(result);
  } catch (error) {
    console.log("error :>> ", error);
    res.status(400).json(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await userService.updateUser(req.params.id as string, req.body);
    if (!users) {
      res.status(404).json({ message: "Not user found" });
      return;
    }
    res.json(users);
  } catch (error) {
    console.log("error :>> ", error);
    res.status(500).json(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await userService.deleteUser(req.params.id as string);
    if (!users) {
      res.status(404).json({ message: "Not user found" });
      return;
    }
    res.json(users);
  } catch (error) {
    console.log("error :>> ", error);
    res.status(500).json(error);
  }
};

export const getUsersSubscriptionInfo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await userService.findUsers();
    const info = users.map((user) => {
      const paid =
        user.subscription &&
        new Date(user.subscription.expirationDate) > new Date();
      return {
        email: user.email,
        username: user.username,
        registeredAt: user.createdAt, // timestamps from Mongoose
        paid,
        licenseExpiration: user.subscription
          ? user.subscription.expirationDate
          : null,
        // Nuevos campos para capacitaciones:
        capSeresArte: user.capSeresArte || false,
        capThr: user.capThr || false,
        capPhr: user.capPhr || false,
        capMat: user.capMat || false,
        capUor: user.capUor || false,
        capReh: user.capReh || false,
        capViv: user.capViv || false,
        capTELA: user.capTELA || false,
        capNO_CONVENCIONAL: user.capNO_CONVENCIONAL || false,
        capDANZA_DRAGON: user.capDANZA_DRAGON || false,
        capPARADA_MANOS: user.capPARADA_MANOS || false,
        capDANZA_AEREA_ARNES: user.capDANZA_AEREA_ARNES || false,
        capCUBO: user.capCUBO || false,
        capPOLE_AEREO: user.capPOLE_AEREO || false,
        capRED: user.capRED || false,
        capCONTORSION: user.capCONTORSION || false,
        capARO: user.capARO || false,
        capACRO_TRAINING: user.capACRO_TRAINING || false,
        capANCESTROS_AL_DESCUBIERTO: user.capANCESTROS_AL_DESCUBIERTO || false,
      };
    });
    res.json(info);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving subscription info", error });
  }
};

export const updateUserCapacitations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;
    // Se esperan valores booleanos para los 4 permisos de capacitación
    const {
      capSeresArte,
      capThr,
      capPhr,
      capMat,
      capReh,
      capViv,
      capUor,
      capTELA,
      capNO_CONVENCIONAL,
      capDANZA_DRAGON,
      capPARADA_MANOS,
      capDANZA_AEREA_ARNES,
      capCUBO,
      capPOLE_AEREO,
      capRED,
      capCONTORSION,
      capARO,
      capACRO_TRAINING,
      capANCESTROS_AL_DESCUBIERTO,
    } = req.body;
    const updatedUser = await userService.updateUser(id, {
      capSeresArte,
      capThr,
      capPhr,
      capMat,
      capReh,
      capViv, // Asumiendo que capViv no se actualiza aquí
      capUor, // Asumiendo que capUor no se actualiza aquí
      capTELA,
      capNO_CONVENCIONAL,
      capDANZA_DRAGON,
      capPARADA_MANOS,
      capDANZA_AEREA_ARNES,
      capCUBO,
      capPOLE_AEREO,
      capRED,
      capCONTORSION,
      capARO,
      capACRO_TRAINING,
      capANCESTROS_AL_DESCUBIERTO,
    });
    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado." });
      return;
    }
    res.json(updatedUser);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const updateUserCapacitationsByEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const email = req.params.email as string;
    const {
      capSeresArte,
      capThr,
      capPhr,
      capMat,
      capReh,
      capUor,
      capViv,
      capTELA,
      capNO_CONVENCIONAL,
      capDANZA_DRAGON,
      capPARADA_MANOS,
      capDANZA_AEREA_ARNES,
      capCUBO,
      capPOLE_AEREO,
      capRED,
      capCONTORSION,
      capARO,
      capACRO_TRAINING,
      capANCESTROS_AL_DESCUBIERTO,
    } = req.body;
    const updatedUser = await userService.updateUserCapacitationsByEmail(
      email,
      {
        capSeresArte,
        capThr,
        capPhr,
        capMat,
        capReh,
        capViv,
        capUor,
        capTELA,
        capNO_CONVENCIONAL,
        capDANZA_DRAGON,
        capPARADA_MANOS,
        capDANZA_AEREA_ARNES,
        capCUBO,
        capPOLE_AEREO,
        capRED,
        capCONTORSION,
        capARO,
        capACRO_TRAINING,
        capANCESTROS_AL_DESCUBIERTO,
      } as any
    );
    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado." });
      return;
    }
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : error,
    });
  }
};
