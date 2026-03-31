'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { RoundData } from '@/lib/types';

interface Props {
  round: RoundData;
  onComplete: (correctCount: number, total: number) => void;
}

type Bucket = { [category: string]: string[] };

export default function DragDropRound({ round, onComplete }: Props) {
  const [unplaced, setUnplaced] = useState<string[]>(round.items.map((i) => i.name));
  const [buckets, setBuckets] = useState<Bucket>(() => {
    const b: Bucket = {};
    round.categories.forEach((c) => (b[c] = []));
    return b;
  });
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ [item: string]: boolean }>({});

  const allPlaced = unplaced.length === 0;

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const item = draggableId;

    // Remove from source
    if (source.droppableId === 'unplaced') {
      setUnplaced((prev) => prev.filter((i) => i !== item));
    } else {
      setBuckets((prev) => ({
        ...prev,
        [source.droppableId]: prev[source.droppableId].filter((i) => i !== item),
      }));
    }

    // Add to destination
    if (destination.droppableId === 'unplaced') {
      setUnplaced((prev) => {
        const copy = [...prev];
        copy.splice(destination.index, 0, item);
        return copy;
      });
    } else {
      setBuckets((prev) => {
        const copy = [...prev[destination.droppableId]];
        copy.splice(destination.index, 0, item);
        return { ...prev, [destination.droppableId]: copy };
      });
    }
  }

  function handleSubmit() {
    const correctMap: { [item: string]: boolean } = {};
    let correct = 0;
    round.items.forEach(({ name, category }) => {
      const isCorrect = buckets[category]?.includes(name);
      correctMap[name] = isCorrect;
      if (isCorrect) correct++;
    });
    setResults(correctMap);
    setSubmitted(true);
  }

  function handleNext() {
    onComplete(
      Object.values(results).filter(Boolean).length,
      round.items.length
    );
  }

  // Touch/tap to move items on mobile
  function handleItemTap(item: string, fromCategory?: string) {
    if (submitted) return;
    // If in unplaced, move to first category
    if (!fromCategory) {
      const target = round.categories[0];
      setUnplaced((prev) => prev.filter((i) => i !== item));
      setBuckets((prev) => ({ ...prev, [target]: [...prev[target], item] }));
    } else {
      // Move back to unplaced
      setBuckets((prev) => ({
        ...prev,
        [fromCategory]: prev[fromCategory].filter((i) => i !== item),
      }));
      setUnplaced((prev) => [...prev, item]);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-center">
        <span className="text-sm text-gray-500">Round {round.roundNumber} of 5</span>
        {round.theme && (
          <p className="text-base font-semibold text-gray-800 mt-1">{round.theme}</p>
        )}
        <p className="text-sm text-gray-500 mt-0.5">Sort each item into the correct category</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Unplaced items */}
        <Droppable droppableId="unplaced" direction="horizontal">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex flex-wrap gap-2 min-h-[60px] p-3 mb-6 rounded-xl border-2 border-dashed transition-colors ${
                snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              {unplaced.length === 0 && !snapshot.isDraggingOver && (
                <span className="text-gray-400 text-sm self-center mx-auto">All items placed!</span>
              )}
              {unplaced.map((item, index) => (
                <Draggable key={item} draggableId={item} index={index} isDragDisabled={submitted}>
                  {(prov, snap) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      {...prov.dragHandleProps}
                      onClick={() => handleItemTap(item)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-grab select-none transition-shadow text-gray-800 ${
                        snap.isDragging
                          ? 'shadow-lg bg-white border-2 border-blue-400'
                          : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {item}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Category buckets */}
        <div className={`grid grid-cols-1 gap-4 ${round.categories.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {round.categories.map((cat) => (
            <Droppable key={cat} droppableId={cat} isDropDisabled={submitted}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-xl border-2 p-3 min-h-[120px] transition-colors ${
                    snapshot.isDraggingOver
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 text-center break-words">
                    {cat}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {buckets[cat].map((item, index) => {
                      const correct = results[item];
                      let bg = 'bg-indigo-50 border-indigo-200';
                      if (submitted) {
                        bg = correct
                          ? 'bg-green-100 border-green-400'
                          : 'bg-red-100 border-red-400';
                      }
                      return (
                        <Draggable
                          key={item}
                          draggableId={item}
                          index={index}
                          isDragDisabled={submitted}
                        >
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => !submitted && handleItemTap(item, cat)}
                              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium border cursor-grab select-none transition-all text-gray-800 ${bg} ${
                                snap.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              {item}
                              {submitted && (
                                <span className="ml-1.5">
                                  {correct ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <div className="mt-6 text-center">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allPlaced}
            className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors shadow-md"
          >
            Check Answers
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-gray-700">
              {Object.values(results).filter(Boolean).length} / {round.items.length} correct
            </p>

            {round.explanation && (
              <div className="text-left bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-1">
                  Boards Insight
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{round.explanation}</p>
              </div>
            )}

            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-md"
            >
              {round.roundNumber < 5 ? 'Next Round \u2192' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
