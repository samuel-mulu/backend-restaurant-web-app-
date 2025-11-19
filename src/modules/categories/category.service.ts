import { Category, CategoryDoc, CategoryType } from "./category.model";

export const createCategory = (data: { type: CategoryType; name: string }) =>
  Category.create(data);
export const listCategories = (type?: CategoryType) => {
  const q: any = { isActive: true };
  if (type) q.type = type;
  return Category.find(q).sort({ name: 1 });
};
export const updateCategory = (
  id: string,
  data: Partial<Pick<CategoryDoc, "name" | "isActive">>
) => Category.findByIdAndUpdate(id, data, { new: true });
export const removeCategory = (id: string) => Category.findByIdAndDelete(id);
