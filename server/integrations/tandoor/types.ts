export type TandoorShoppingList = {
  id: number;
  title: string;
  created_by: number;
  created_at: string;
  note: string;
  entries: TandoorShoppingListEntry[];
};

export type TandoorShoppingListEntry = {
  id: number;
  list_recipe: number | null;
  food: {
    id: number;
    name: string;
    plural_name: string;
  };
  unit: {
    id: number;
    name: string;
    plural_name: string;
  } | null;
  amount: number;
  order: number;
  checked: boolean;
};

export type TandoorFood = {
  id: number;
  name: string;
};

export type TandoorUnit = {
  id: number;
  name: string;
  plural_name: string;
};
