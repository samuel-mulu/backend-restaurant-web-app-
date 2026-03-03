import { Router } from "express";
import { requireAuth, requireRole } from "../../common/middleware/authMiddleware";
import * as expenseController from "./expense.controller";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole("owner", "cashier"), expenseController.createExpense);
router.get("/", requireRole("owner"), expenseController.getExpenses);
router.delete("/:id", requireRole("owner"), expenseController.deleteExpense);

export default router;
