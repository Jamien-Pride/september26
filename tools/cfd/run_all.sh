#!/bin/bash
# Mesh and solve the funnel at several wind directions, then integrate forces.
# Usage: run_all.sh <work_dir> <level> <delta> [delta ...]

HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$1; LEVEL=$2; shift 2
source /usr/share/openfoam/etc/bashrc >/dev/null 2>&1
mkdir -p "$WORK"
for D in "$@"; do
  C="$WORK/L${LEVEL}_d$D"
  if [ -f "$C/forces_history.json" ]; then continue; fi
  rm -rf "$C"; python3 "$HERE/make_case.py" "$C" "$D" "$LEVEL"
  cd "$C"
  blockMesh > log.blockMesh 2>&1
  snappyHexMesh -overwrite > log.snappy 2>&1
  checkMesh > log.checkMesh 2>&1
  decomposePar -force > log.decompose 2>&1
  mpirun --allow-run-as-root --oversubscribe -np 4 simpleFoam -parallel > log.simpleFoam 2>&1
  for t in $(ls processor0 | grep -E '^[0-9]+$' | grep -v '^0$' | sort -n); do
    python3 "$HERE/forces.py" . "$t"
  done > forces_history.json
  rm -rf processor*/[1-9]*/phi
  cd - >/dev/null
  echo "done $D $(date)"
done
