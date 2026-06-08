export type MealieShoppingList = {
  id: string;
  name: string;
  extras: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  groupId: string;
  userId: string;
  householdId: string;
  listItems: MealieShoppingListItem[];
  labelSettings: MealieLabelSetting[];
  recipeReferences: MealieRecipeReference[];
};

export type MealieShoppingListItem = {
  createdItems: MealieShoppingListItem[];
  id: string | null;
  quantity: number;
  unit: MealieUnit | null;
  food: MealieFood | null;
  note: string;
  isFood: boolean;
  disableAmount: boolean;
  display: string;
  shoppingListId: string;
  checked: boolean;
  position: number;
  foodId: string | null;
  labelId: string | null;
  unitId: string | null;
  extras: Record<string, unknown>;
  groupId: string;
  householdId: string;
  label: MealieLabel | null;
  recipeReferences: MealieRecipeReference[];
  createdAt: string;
  updatedAt: string;
};

export type MealieUnit = {
  id: string;
  name: string;
  pluralName: string;
  description: string;
  extras: Record<string, unknown>;
  fraction: boolean;
  abbreviation: string;
  pluralAbbreviation: string | null;
  useAbbreviation: boolean;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
};

export type MealieFood = {
  id: string;
  name: string;
  pluralName: string | null;
  description: string;
  extras: Record<string, unknown>;
  labelId: string | null;
  aliases: string[];
  householdsWithIngredientFood: MealieHousehold[];
  label: MealieLabel | null;
  createdAt: string;
  updatedAt: string;
};

export type MealieRecipeReference = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  recipeYield: number;
  totalTime: string | null;
  prepTime: string | null;
  cookTime: string | null;
  performTime: string | null;
  rating: number | null;
  orgURL: string | null;
  dateAdded: string;
  dateUpdated: string;
  createdAt: string;
  updatedAt: string;
};

export type MealieHousehold = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MealieLabel = {
  name: string;
  color: string;
  groupId: string;
  id: string;
};

export type MealieLabelSetting = {
  shoppingListId: string;
  labelId: string;
  position: number;
  id: string;
  label: MealieLabel;
};

export type PaginatedResponse<T> = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
  next: string | null;
  previous: string | null;
};

export type MealieBulkUpdateResponse = {
  createdItems: MealieShoppingListItem[];
  updatedItems: MealieShoppingListItem[];
  deletedItems: MealieShoppingListItem[];
};
