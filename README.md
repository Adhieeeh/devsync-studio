# DevSync — Offline-First Collaborative CRDT Task Engine (React)

DevSync is an offline-first collaborative task management studio and Conflict-Free Replicated Data Type (CRDT) engine built with React. It models the distributed state algorithms powering platforms like Linear, Figma Tasks, and Notion: LWW-Element-Set (Last-Write-Wins) CRDTs, Lamport timestamps, network partition simulations, and tombstone-based garbage collection.

## Preview



##  Technical Architecture Overview
*  **LWW-Element-Set CRDT:** Implements a deterministic conflict-resolution algorithm where concurrent mutations resolve mathematically without user-facing merge conflicts.
*  **Lamport Timestamps & Causality:** Tracks causal operation ordering across partitioned peer nodes using monotonically increasing logical clocks.
*  **Network Partition Simulator:** Demonstrates offline mutations and bi-directional CRDT convergence upon reconnection.
*  **Tombstone State Deletions:** Preserves deleted records as tombstones with updated clocks to prevent resurrected state anomalies across distributed clients.

##  

2. Launch dev server: `npm run dev`
