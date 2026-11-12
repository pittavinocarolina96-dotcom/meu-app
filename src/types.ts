export type Category = "top" | "bottom" | "outer" | "shoes" | "accessory";
export type Status = "want" | "bought" | "discarded";

export interface Item {
  id: string;
  image: string; // dataURL (fundo removido quando possível)
  name: string;
  category: Category;
  colors: string[]; // ids de colors.ts; o primeiro é a cor principal
  styles: string[];
  occasions: string[]; // vazio = serve para qualquer ocasião
  seasons: string[]; // vazio = qualquer clima
  price?: number;
  link?: string;
  store?: string;
  status: Status;
  createdAt: number;
}

export interface LookItems {
  top: string;
  bottom: string;
  outer?: string;
  shoes?: string;
  accessories: string[];
}

export interface SavedLook extends LookItems {
  id: string;
  title?: string;
  note?: string; // explicação da IA ou anotação
  source: "auto" | "manual" | "ia";
  createdAt: number;
}

export interface Profile {
  favColors: string[];
  avoidColors: string[];
  styles: string[];
}

export interface Settings {
  apiKey: string;
  model: string;
}
