"use client";

import { Bookmark, Compass, MapPin, Search, Star, User, Users } from "lucide-react";

export function PhoneMapMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[275px] drop-shadow-xl select-none">
      {/* Sleek Outer Phone Frame */}
      <div className="relative rounded-[42px] border-[4px] border-[#2C2A26] bg-[#1C1B1A] p-1.5 shadow-2xl ring-1 ring-black/15">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-3 left-1/2 z-30 h-3.5 w-20 -translate-x-1/2 rounded-full bg-[#121110]" />

        {/* Screen Container */}
        <div className="relative h-[520px] w-full overflow-hidden rounded-[34px] bg-[#FCFBF9] text-[#1C1B1A] flex flex-col justify-between">
          {/* Status Bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-2.5 text-[10px] font-semibold text-[#1C1B1A]">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] uppercase font-bold tracking-wider">5G</span>
            </div>
          </div>

          {/* Floating Search Bar */}
          <div className="relative z-20 px-3 pt-1.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-[#E8E5DE] bg-white/95 px-2.5 py-1.5 shadow-xs backdrop-blur-md">
              <Search className="size-3 text-[#706E6B]" />
              <span className="text-[10px] text-[#706E6B] font-medium truncate">Search cafés near you...</span>
            </div>
          </div>

          {/* Map Simulation Background */}
          <div className="absolute inset-0 z-0 bg-[#F4F2EC]">
            {/* Grid / Street Paths */}
            <svg className="absolute inset-0 size-full opacity-35" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D5D0C5" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <path d="M-20 160 Q 120 140 300 200" fill="none" stroke="#E2DEC8" strokeWidth="14" />
              <path d="M100 -10 Q 150 240 120 540" fill="none" stroke="#E2DEC8" strokeWidth="18" />
              <path d="M-20 360 Q 160 340 300 320" fill="none" stroke="#E2DEC8" strokeWidth="12" />
            </svg>

            {/* User GPS Pulse */}
            <div className="absolute top-[250px] left-[115px] flex size-6 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#382215]/25" />
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-[#382215] shadow-md" />
            </div>

            {/* Pinned Cafe 1: Yardstick */}
            <div className="absolute top-[135px] left-[40px] flex flex-col items-center">
              <div className="flex items-center gap-1 rounded-full border border-[#E8E5DE] bg-white px-2 py-0.5 text-[9px] font-bold text-[#1C1B1A] shadow-md">
                <Star className="size-2.5 fill-amber-400 text-amber-400" />
                <span>Yardstick 4.9</span>
              </div>
              <div className="size-1.5 bg-[#382215] rotate-45 -mt-0.5" />
            </div>

            {/* Pinned Cafe 2: Commune */}
            <div className="absolute top-[195px] right-[25px] flex flex-col items-center">
              <div className="flex items-center gap-1 rounded-full border border-[#E8E5DE] bg-white px-1.5 py-0.5 text-[8px] font-semibold text-[#1C1B1A] shadow-xs">
                <span>Commune 4.8</span>
              </div>
            </div>

            {/* Pinned Cafe 3: Single Origin */}
            <div className="absolute top-[310px] left-[25px] flex flex-col items-center">
              <div className="flex items-center gap-1 rounded-full border border-[#E8E5DE] bg-white px-1.5 py-0.5 text-[8px] font-semibold text-[#1C1B1A] shadow-xs">
                <span>Single Origin 4.7</span>
              </div>
            </div>
          </div>

          {/* Bottom Card Preview & Mini Navigation */}
          <div className="relative z-20 space-y-1.5 p-2">
            {/* Selected Café Sheet */}
            <div className="rounded-xl border border-[#E8E5DE] bg-white p-2 shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#1C1B1A]">
                    <span>Yardstick Coffee</span>
                    <span className="rounded bg-emerald-100 px-1 py-0.2 text-[7px] font-bold text-emerald-800">Open</span>
                  </div>
                  <p className="text-[9px] text-[#706E6B]">Legazpi Village • 350m</p>
                </div>
                <div className="rounded-full border border-[#E8E5DE] p-1 text-[#382215]">
                  <Bookmark className="size-2.5" />
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-[#F4F2EC] pt-1 text-[8px]">
                <span className="font-semibold text-[#706E6B]">Saved by 4 friends</span>
                <span className="font-bold text-[#382215]">Log Visit →</span>
              </div>
            </div>

            {/* Simulated Bottom Nav */}
            <div className="flex h-10 items-center justify-around rounded-xl border border-[#E8E5DE] bg-white/95 px-1.5 backdrop-blur-md">
              <div className="flex flex-col items-center text-[#382215]">
                <MapPin className="size-3 text-[#382215]" />
                <span className="text-[7px] font-bold">Map</span>
              </div>
              <div className="flex flex-col items-center text-[#706E6B]">
                <Compass className="size-3" />
                <span className="text-[7px]">Discover</span>
              </div>
              <div className="flex size-5 items-center justify-center rounded-full bg-[#382215] text-white shadow-xs">
                <span className="text-[10px] font-bold leading-none">+</span>
              </div>
              <div className="flex flex-col items-center text-[#706E6B]">
                <Users className="size-3" />
                <span className="text-[7px]">Circles</span>
              </div>
              <div className="flex flex-col items-center text-[#706E6B]">
                <User className="size-3" />
                <span className="text-[7px]">You</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

