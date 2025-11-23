import { Request, Response } from "express";
import * as tableService from "./table.service";

const send = (res: Response, status: number, data: any) => {
  return res.status(status).json({ success: true, ...data });
};

const sendError = (res: Response, err: any) => {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  console.error("Unexpected table error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

export const create = async (req: Request, res: Response) => {
  try {
    const table = await tableService.createTable(req.body);
    send(res, 201, { data: table });
  } catch (err) {
    sendError(res, err);
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const filters: any = {};

    if (search) filters.search = search as string;

    const tables = await tableService.listTables(filters);
    send(res, 200, { data: tables });
  } catch (err) {
    sendError(res, err);
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const table = await tableService.getTableById(req.params.id);
    send(res, 200, { data: table });
  } catch (err) {
    sendError(res, err);
  }
};

export const getByNumber = async (req: Request, res: Response) => {
  try {
    const table = await tableService.getTableByNumber(req.params.tableNumber);
    send(res, 200, { data: table });
  } catch (err) {
    sendError(res, err);
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const table = await tableService.updateTable(req.params.id, req.body);
    send(res, 200, { data: table });
  } catch (err) {
    sendError(res, err);
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await tableService.removeTable(req.params.id);
    send(res, 200, {
      message: "Table deleted successfully",
    });
  } catch (err) {
    sendError(res, err);
  }
};
