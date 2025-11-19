import { Request, Response } from "express";
import * as svc from "./category.service";

export const create = async (req: Request, res: Response) =>
  res.status(201).json(await svc.createCategory(req.body));
export const list = async (req: Request, res: Response) =>
  res.json(await svc.listCategories(req.query.type as any));
export const update = async (req: Request, res: Response) =>
  res.json(await svc.updateCategory(req.params.id, req.body));
export const remove = async (req: Request, res: Response) => {
  await svc.removeCategory(req.params.id);
  res.json({ success: true });
};
