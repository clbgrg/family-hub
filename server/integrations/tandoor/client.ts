import { consola } from "consola";

import type {
  TandoorFood,
  TandoorShoppingListEntry,
  TandoorUnit,
} from "./types";

export class TandoorService {
  private integrationId: string;

  constructor(integrationId: string) {
    this.integrationId = integrationId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const formattedEndpoint = path.startsWith("/") ? path : `/${path}`;
    const url = `/api/integrations/tandoor${formattedEndpoint}?integrationId=${this.integrationId}`;

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      consola.error("Tandoor Client: Response error:", errorText);
      throw new Error(`Tandoor API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getShoppingListEntries(): Promise<TandoorShoppingListEntry[]> {
    const response = await this.request<TandoorShoppingListEntry[]>("/shopping-list-entry/");
    return response;
  }

  async getShoppingListEntry(id: number): Promise<TandoorShoppingListEntry> {
    return await this.request<TandoorShoppingListEntry>(`/shopping-list-entry/${id}/`);
  }

  async createShoppingListEntry(data: {
    food: { name: string };
    unit?: { name: string };
    amount: string;
    list_recipe?: number;
  }): Promise<TandoorShoppingListEntry> {
    const response = await this.request<TandoorShoppingListEntry>("/shopping-list-entry/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  async updateShoppingListEntry(id: number, data: {
    amount?: string;
    checked?: boolean;
    order?: number;
  }): Promise<TandoorShoppingListEntry> {
    return await this.request<TandoorShoppingListEntry>(`/shopping-list-entry/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteShoppingListEntry(id: number): Promise<void> {
    await this.request(`/shopping-list-entry/${id}/`, {
      method: "DELETE",
    });
  }

  async searchFoods(query: string): Promise<TandoorFood[]> {
    const response = await this.request<{ results: TandoorFood[] }>(`/food/?search=${encodeURIComponent(query)}`);
    return response.results;
  }

  async getUnits(): Promise<TandoorUnit[]> {
    const response = await this.request<{ results: TandoorUnit[] }>("/unit/");
    return response.results;
  }
}
