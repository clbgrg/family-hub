import type {
  MealieBulkUpdateResponse,
  MealieFood,
  MealieShoppingList,
  MealieShoppingListItem,
  MealieUnit,
  PaginatedResponse,
} from "./types";

export class MealieService {
  private integrationId: string;

  constructor(integrationId: string) {
    this.integrationId = integrationId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `/api/integrations/mealie/${path}${path.includes("?") ? "&" : "?"}integrationId=${this.integrationId}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Mealie API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getShoppingLists(): Promise<PaginatedResponse<MealieShoppingList>> {
    return await this.request<PaginatedResponse<MealieShoppingList>>("api/households/shopping/lists");
  }

  async getShoppingList(id: string): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>(`api/households/shopping/lists/${id}`);
  }

  async createShoppingList(data: { name: string }): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>("api/households/shopping/lists", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateShoppingList(id: string, data: { name: string }): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>(`api/households/shopping/lists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteShoppingList(id: string): Promise<void> {
    await this.request(`api/households/shopping/lists/${id}`, {
      method: "DELETE",
    });
  }

  async createShoppingListItems(listId: string, items: Partial<MealieShoppingListItem>[]): Promise<MealieShoppingListItem[]> {
    return await this.request<MealieShoppingListItem[]>(`api/households/shopping/items`, {
      method: "POST",
      body: JSON.stringify(items),
    });
  }

  async createShoppingListItem(item: Partial<MealieShoppingListItem>): Promise<MealieShoppingListItem> {
    return await this.request<MealieShoppingListItem>(`api/households/shopping/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async deleteShoppingListItems(ids: string[]): Promise<{ message: string; error: boolean }> {
    const queryParams = new URLSearchParams();
    ids.forEach(id => queryParams.append("ids", id));
    return await this.request<{ message: string; error: boolean }>(`api/households/shopping/items?${queryParams.toString()}`, {
      method: "DELETE",
    });
  }

  async getFoods(): Promise<MealieFood[]> {
    return await this.request<MealieFood[]>("api/foods");
  }

  async createFood(data: { name: string; pluralName?: string }): Promise<MealieFood> {
    return await this.request<MealieFood>("api/foods", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getUnits(): Promise<MealieUnit[]> {
    return await this.request<MealieUnit[]>("api/units");
  }

  async createUnit(data: { name: string; pluralName?: string }): Promise<MealieUnit> {
    return await this.request<MealieUnit>("api/units", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateShoppingListItem(items: MealieShoppingListItem[]): Promise<MealieBulkUpdateResponse> {
    return await this.request<MealieBulkUpdateResponse>("api/households/shopping/items", {
      method: "PUT",
      body: JSON.stringify(items),
    });
  }

  async updateShoppingListItemById(itemId: string, data: Partial<MealieShoppingListItem>): Promise<MealieShoppingListItem> {
    return await this.request<MealieShoppingListItem>(`api/households/shopping/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
}
