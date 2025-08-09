import { useEffect, useMemo, useState } from "react";
import pokemonList from "../data/pokemons.json";

type Pokemon = {
  id: string;
  name: string;
  imageUrl: string;
};

interface PokemonSelectorProps {
  isOpen: boolean;
  selectedIds: string[];
  max?: number;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

export default function PokemonSelector({
  isOpen,
  selectedIds,
  max = 5,
  onClose,
  onSave,
}: PokemonSelectorProps) {
  const [tempSelected, setTempSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    setTempSelected(selectedIds);
  }, [selectedIds, isOpen]);

  const pokemons = pokemonList as Pokemon[];

  const selectedSet = useMemo(() => new Set(tempSelected), [tempSelected]);

  const toggle = (id: string) => {
    setTempSelected((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev; // ignore when reaching max
      return [...prev, id];
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-[90vw] max-w-3xl max-h-[85vh] rounded-xl shadow-xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">
            得意なポケモンを選択（最大{max}つ）
          </h3>
          <button
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        <div className="overflow-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {pokemons.map((p) => {
              const active = selectedSet.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`border rounded-lg p-2 flex flex-col items-center gap-2 hover:shadow transition ${
                    active
                      ? "border-indigo-500 ring-2 ring-indigo-200"
                      : "border-gray-200"
                  }`}
                  onClick={() => toggle(p.id)}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <span className="text-sm">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700"
            onClick={() => onSave(tempSelected)}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
