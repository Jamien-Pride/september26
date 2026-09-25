#!/bin/bash
# Mesh, solve and integrate forces for one prepared case directory.
HERE=$(cd "$(dirname "$0")" && pwd)
source /usr/share/openfoam/etc/bashrc >/dev/null 2>&1
cd "$1" || exit 1
blockMesh > log.blockMesh 2>&1
snappyHexMesh -overwrite > log.snappy 2>&1
checkMesh > log.checkMesh 2>&1
decomposePar -force > log.decompose 2>&1
mpirun --allow-run-as-root --oversubscribe -np 4 simpleFoam -parallel > log.simpleFoam 2>&1
for t in $(ls processor0 | grep -E '^[0-9]+$' | grep -v '^0$' | sort -n); do python3 "$HERE/forces.py" . "$t"; done > forces_history.json
rm -rf processor*/[1-9]*/phi
