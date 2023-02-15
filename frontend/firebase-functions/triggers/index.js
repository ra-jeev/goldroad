const functions = require('firebase-functions');
const { getApps, initializeApp, getApp } = require('firebase-admin/app');
const { initializeFirestore } = require('firebase-admin/firestore');
const { defineString } = require('firebase-functions/params');

const dataApiUrl = defineString('DATA_API_URL');
const dataApiKey = defineString('DATA_API_KEY');
const dataSource = defineString('DATA_SOURCE');
const dbName = defineString('DB_NAME');

const app = !getApps().length ? initializeApp() : getApp();
const fireStore = initializeFirestore(app, { preferRest: true });

const makeApiCall = async (action, data) => {
  const body = {
    dataSource: dataSource.value(),
    database: dbName.value(),
    ...data,
  };

  const resp = await fetch(dataApiUrl.value() + action, {
    method: 'POST',
    headers: {
      'api-key': dataApiKey.value(),
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.log(`API call failed with: ${resp.statusText}, text:`, text);
    return text || resp.statusText;
  }

  return await resp.json();
};

const handleCurrStreak = (
  oldUserStreak,
  oldUserLastGame,
  newUserStreak,
  newUserLastGame
) => {
  let finalStreak;
  const newLastSolvedGameNo = newUserLastGame.solved
    ? newUserLastGame.gameNo
    : newUserStreak
    ? newUserLastGame.gameNo - 1
    : 0;
  const oldLastSolvedGameNo = oldUserLastGame.solved
    ? oldUserLastGame.gameNo
    : oldUserStreak
    ? oldUserLastGame.gameNo - 1
    : 0;
  const newFirstSolvedGameInStreak = newUserStreak
    ? newUserLastGame.gameNo - newUserStreak + (newUserLastGame.solved ? 1 : 0)
    : 0;
  const oldFirstSolvedGameInStreak = oldUserStreak
    ? oldUserLastGame.gameNo - oldUserStreak + (oldUserLastGame.solved ? 1 : 0)
    : 0;

  console.log(
    `oldFirstSolvedGameInStreak: ${oldFirstSolvedGameInStreak}, oldLastSolvedGameNo: ${oldLastSolvedGameNo}`
  );
  console.log(
    `newFirstSolvedGameInStreak: ${newFirstSolvedGameInStreak}, newLastSolvedGameNo: ${newLastSolvedGameNo}`
  );

  if (
    !newUserStreak &&
    oldUserStreak &&
    oldUserLastGame.gameNo >= newUserLastGame.gameNo
  ) {
    finalStreak = oldUserStreak;
    console.log(
      `Since no newUser.data.currStreak, change currStreak to ${finalStreak}`
    );
  } else if (oldUserStreak && newUserStreak) {
    if (
      oldLastSolvedGameNo === newLastSolvedGameNo &&
      oldUserStreak > newUserStreak
    ) {
      finalStreak = oldUserStreak;
      console.log(
        `Since oldLastSolvedGameNo === newLastSolvedGameNo &&
         oldUserStreak > newUserStreak, change currStreak to ${finalStreak}`
      );
    } else if (
      oldFirstSolvedGameInStreak === newFirstSolvedGameInStreak &&
      oldUserStreak > newUserStreak
    ) {
      finalStreak = oldUserStreak;
      console.log(
        `Since oldFirstSolvedGameInStreak === newFirstSolvedGameInStreak &&
         oldUserStreak > newUserStreak, change currStreak to ${finalStreak}`
      );
    } else if (oldLastSolvedGameNo > newLastSolvedGameNo) {
      if (oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1) {
        if (oldFirstSolvedGameInStreak < newFirstSolvedGameInStreak) {
          finalStreak = oldUserStreak;
          console.log(
            `Since oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1 &&
           oldLastSolvedGameNo > newLastSolvedGameNo &&
            oldFirstSolvedGameInStreak < newFirstSolvedGameInStreak, change currStreak to ${finalStreak}`
          );
        } else {
          finalStreak =
            newUserStreak + (oldLastSolvedGameNo - newLastSolvedGameNo);
          console.log(
            `Since oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1 &&
           oldLastSolvedGameNo > newLastSolvedGameNo, change currStreak to ${finalStreak}`
          );
        }
      } else if (oldFirstSolvedGameInStreak > newLastSolvedGameNo) {
        finalStreak = oldUserStreak;
        console.log(
          `Since oldLastSolvedGameNo > newLastSolvedGameNo &&
          oldFirstSolvedGameInStreak > newLastSolvedGameNo, change currStreak to ${finalStreak}`
        );
      }
    } else if (
      newLastSolvedGameNo > oldLastSolvedGameNo &&
      newFirstSolvedGameInStreak <= oldLastSolvedGameNo + 1 &&
      newFirstSolvedGameInStreak > oldFirstSolvedGameInStreak
    ) {
      finalStreak = oldUserStreak + (newLastSolvedGameNo - oldLastSolvedGameNo);
      console.log(
        `Since newLastSolvedGameNo > oldLastSolvedGameNo &&
        newFirstSolvedGameInStreak <= oldLastSolvedGameNo + 1 &&
        newFirstSolvedGameInStreak > oldFirstSolvedGameInStreak, change currStreak to ${finalStreak}`
      );
    }
  }

  return finalStreak;
};

exports.onNewMigration = functions
  .region('asia-south1')
  .firestore.document('migrations/{migrationId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    console.log(`new migration job: ${JSON.stringify(data, null, 2)}`);
    if (
      ['realm', 'firebase'].includes(data.type) &&
      data.oldUserId &&
      data.newUserId
    ) {
      let updateOldGames = true;
      const time = Date.now();

      if (data.type === 'firebase') {
        const oldUserResp = await makeApiCall('/action/findOne', {
          collection: 'users',
          filter: { _id: data.oldUserId },
        });

        const oldUser =
          oldUserResp && typeof oldUserResp !== 'string'
            ? oldUserResp.document
            : null;

        if (!oldUser) {
          console.log(`no oldUser found`);
          return null;
        }

        if (oldUser?.data.played) {
          const newUserResp = await makeApiCall('/action/findOne', {
            collection: 'users',
            filter: { _id: data.newUserId },
          });

          const newUser =
            newUserResp && typeof newUserResp !== 'string'
              ? newUserResp.document
              : null;

          if (!newUser) {
            console.log(`no newUser found`);
            return null;
          }

          const userChanges = {};
          const gamesToDelete = [];
          const gamesToModify = [];
          const oldGames = [];

          if (newUser.data.played) {
            let newGamesPlayed = newUser.data.played + oldUser.data.played;
            let newGamesSolves = newUser.data.solves + oldUser.data.solves;

            const solveStats = newUser.data.solveStats || {};
            const gamesObj = newUser.data.games || {};
            if (oldUser.data.solveStats) {
              Object.keys(oldUser.data.solveStats).forEach((tries) => {
                solveStats[tries] =
                  oldUser.data.solveStats[tries] + (solveStats[tries] || 0);
              });
            }

            if (oldUser.data.games) {
              Object.keys(oldUser.data.games).forEach((gameNo) => {
                if (gamesObj[gameNo]) {
                  gamesObj[gameNo] = {
                    solved:
                      gamesObj[gameNo].solved ||
                      oldUser.data.games[gameNo].solved,
                    tries:
                      gamesObj[gameNo].tries + oldUser.data.games[gameNo].tries,
                  };
                } else {
                  gamesObj[gameNo] = oldUser.data.games[gameNo];
                }
              });
            }

            let firstGame =
              oldUser.data.firstGame &&
              oldUser.data.firstGame < newUser.data.firstGame
                ? oldUser.data.firstGame
                : undefined;

            if (firstGame) {
              userChanges[`data.firstGame`] = firstGame;
            }

            if (oldUser.data.longestStreak > newUser.data.longestStreak) {
              userChanges[`data.longestStreak`] = oldUser.data.longestStreak;
            }

            if (oldUser.data.lastGamePlayed) {
              if (!newUser.data.lastGamePlayed) {
                userChanges[`data.lastGamePlayed`] =
                  oldUser.data.lastGamePlayed;
              } else {
                // Check and update the last game played
                const newLastGamePlayed = newUser.data.lastGamePlayed;
                const oldLastGamePlayed = oldUser.data.lastGamePlayed;
                if (newLastGamePlayed.gameNo < oldLastGamePlayed.gameNo) {
                  userChanges[`data.lastGamePlayed`] = oldLastGamePlayed;
                } else if (
                  newLastGamePlayed.gameNo === oldLastGamePlayed.gameNo
                ) {
                  userChanges[`data.lastGamePlayed.solved`] =
                    newLastGamePlayed.solved || oldLastGamePlayed.solved;
                  userChanges[`data.lastGamePlayed.tries`] =
                    newLastGamePlayed.tries + oldLastGamePlayed.tries;
                  if (newLastGamePlayed.score < oldLastGamePlayed.score) {
                    userChanges[`data.lastGamePlayed.score`] =
                      oldLastGamePlayed.score;
                    userChanges[`data.lastGamePlayed.moves`] =
                      oldLastGamePlayed.moves;
                  }
                }

                // Check if we need to update the currStreak
                const streak = handleCurrStreak(
                  oldUser.data.currStreak,
                  oldLastGamePlayed,
                  newUser.data.currStreak,
                  newLastGamePlayed
                );

                if (streak) {
                  userChanges[`data.currStreak`] = streak;
                }
              }
            }

            // Check if we need to re-update the longestStreak because of currStreak changes
            if (userChanges[`data.currStreak`]) {
              if (
                (userChanges[`data.longestStreak`] &&
                  userChanges[`data.longestStreak`] <=
                    userChanges[`data.currStreak`]) ||
                (!userChanges[`data.longestStreak`] &&
                  userChanges[`data.currStreak`] >= newUser.data.longestStreak)
              ) {
                userChanges[`data.longestStreak`] =
                  userChanges[`data.currStreak`];
                userChanges[`data.isCurrLongestStreak`] = true;
              } else if (newUser.data.isCurrLongestStreak) {
                userChanges[`data.isCurrLongestStreak`] = false;
              }
            }

            // Fetch user games for old user id
            const oldGamesResp = await makeApiCall('/action/find', {
              collection: 'userGames',
              filter: {
                owner_id: data.oldUserId,
              },
              sort: {
                gameNo: -1,
              },
              limit: oldUser.data.played,
            });

            if (oldGamesResp && typeof oldGamesResp !== 'string') {
              oldGames.push(...oldGamesResp.documents);
            }

            if (oldGames.length) {
              const gamesToCheck = [];

              oldGames.forEach((oldGame) => {
                gamesToCheck.push(oldGame.gameNo);
              });

              const newGamesResp = await makeApiCall('/action/find', {
                collection: 'userGames',
                filter: {
                  owner_id: data.newUserId,
                  gameNo: { $in: gamesToCheck },
                },
                sort: {
                  gameNo: -1,
                },
              });

              if (newGamesResp && newGamesResp !== 'string') {
                const newGames = newGamesResp.documents;
                console.log(`intersecting games length: ${newGames.length}`);
                newGames.forEach((newGame) => {
                  const oldGameIndex = oldGames.findIndex(
                    (oldGame) => oldGame.gameNo === newGame.gameNo
                  );

                  const oldGame = oldGames.splice(oldGameIndex, 1)[0];
                  console.log(`matching gameNo: ${oldGame.gameNo}`);

                  for (const attempt of oldGame.attempts) {
                    attempt.mergedFrom = data.oldUserId;
                  }

                  const totalAttempts = [
                    ...newGame.attempts,
                    ...oldGame.attempts,
                  ];

                  // Since this is a common game, need to reduce played games count
                  newGamesPlayed--;
                  if (oldGame.firstSolved >= 0 && newGame.firstSolved >= 0) {
                    // Since this is a common game solve, need to reduce solved games count
                    newGamesSolves--;

                    // Reduce the solve stats count for both the old user game and the new user game
                    solveStats[oldGame.attempts[oldGame.firstSolved].tries]--;
                    solveStats[newGame.attempts[newGame.firstSolved].tries]--;
                  }

                  totalAttempts.sort((attempt1, attempt2) => {
                    return attempt1.playedAt === attempt2.playedAt
                      ? 0
                      : attempt1.playedAt < attempt2.playedAt
                      ? -1
                      : 1;
                  });

                  let firstSolved = -1;
                  for (let i = 0; i < totalAttempts.length; i++) {
                    if (totalAttempts[i].solved) {
                      firstSolved = i;
                      break;
                    }
                  }

                  const finalChanges = {
                    attempts: totalAttempts,
                    hasMerges: true,
                    updatedAt: { $date: { $numberLong: `${time}` } },
                  };

                  if (firstSolved > -1) {
                    finalChanges.firstSolved = firstSolved;

                    if (oldGame.firstSolved >= 0 && newGame.firstSolved >= 0) {
                      // Increment the solve stat count here
                      solveStats[totalAttempts[firstSolved].tries]++;
                    }
                  }

                  gamesToDelete.push({ $oid: oldGame._id });
                  gamesToModify.push({
                    collection: 'userGames',
                    filter: {
                      _id: { $oid: newGame._id },
                    },
                    update: {
                      $set: finalChanges,
                    },
                  });
                });
              }
            }

            userChanges[`data.played`] = newGamesPlayed;
            userChanges[`data.solves`] = newGamesSolves;
            if (Object.keys(solveStats).length) {
              for (const key in solveStats) {
                if (!solveStats[key]) {
                  delete solveStats[key];
                }
              }

              userChanges[`data.solveStats`] = solveStats;
            }

            if (Object.keys(gamesObj).length) {
              userChanges[`data.games`] = gamesObj;
            }
          } else {
            userChanges.data = { ...oldUser.data };
          }

          console.log(
            `final user changes: ${JSON.stringify(userChanges, null, 2)}`
          );

          if (Object.keys(userChanges).length) {
            const updateUserResp = await makeApiCall('/action/updateOne', {
              collection: 'users',
              filter: {
                _id: data.newUserId,
              },
              update: {
                $set: {
                  ...userChanges,
                  updatedAt: { $date: { $numberLong: `${time}` } },
                },
              },
            });

            console.log(
              `updateUserResp: ${JSON.stringify(updateUserResp, null, 2)}`
            );

            const getUpdatedUserResp = await makeApiCall('/action/findOne', {
              collection: 'users',
              filter: {
                _id: data.newUserId,
              },
            });

            console.log(
              `getUpdatedUserResp: ${JSON.stringify(
                getUpdatedUserResp,
                null,
                2
              )}`
            );

            if (getUpdatedUserResp?.document) {
              try {
                await fireStore
                  .collection('migratedUsers')
                  .doc(data.newUserId)
                  .create(getUpdatedUserResp.document);
              } catch (error) {
                console.log('failed to create the firestore document', error);
              }
            }
          }

          if (gamesToDelete.length) {
            console.log(
              `gamesToDelete: ${JSON.stringify(gamesToDelete, null, 2)}`
            );

            const deleteGamesResp = await makeApiCall('/action/updateMany', {
              collection: 'userGames',
              filter: {
                _id: { $in: gamesToDelete },
              },
              update: {
                $set: {
                  owner_id: 'delete',
                  prev_owner_id: data.oldUserId,
                  migrated_owner_id: data.newUserId,
                  updatedAt: { $date: { $numberLong: `${time}` } },
                },
              },
            });

            console.log(
              `deleteGamesResp: ${JSON.stringify(deleteGamesResp, null, 2)}`
            );
          }

          if (gamesToModify.length) {
            console.log(
              `gamesToModify: ${JSON.stringify(gamesToModify, null, 2)}`
            );

            const promises = [];
            for (const gameToModify of gamesToModify) {
              promises.push(makeApiCall('/action/updateOne', gameToModify));
            }

            const deleteGamesResp = await Promise.allSettled(promises);
            console.log(
              `modifyGamesResp: ${JSON.stringify(deleteGamesResp, null, 2)}`
            );
          }

          if (!oldGames.length && newUser.data.played) {
            console.log(`no old gamesToUpdate to new user id`);
            updateOldGames = false;
          }
        } else {
          try {
            await fireStore
              .collection('migratedUsers')
              .doc(data.newUserId)
              .create({ status: 'Unmodified' });
          } catch (error) {
            console.log('failed to create the firestore document', error);
          }
        }
      }

      if (updateOldGames) {
        const body = {
          collection: 'userGames',
          filter: {
            owner_id: data.oldUserId,
          },
          update: {
            $set: {
              owner_id: data.newUserId,
              prev_owner_id: data.oldUserId,
              updatedAt: { $date: { $numberLong: `${time}` } },
            },
          },
        };

        const resp = await makeApiCall('/action/updateMany', body);
        if (resp && typeof resp !== 'string') {
          console.log(
            `updated the userGames document with new id: ${JSON.stringify(
              resp
            )}`
          );
        }
      }

      const delResp = await makeApiCall('/action/updateOne', {
        collection: 'users',
        filter: {
          _id: data.oldUserId,
        },
        update: {
          $set: {
            migrated_id: data.newUserId,
            delete: true,
            updatedAt: { $date: { $numberLong: `${time}` } },
          },
        },
      });

      console.log(`delete old user resp: ${JSON.stringify(delResp)}`);

      return snap.ref.delete();
    }

    return null;
  });
