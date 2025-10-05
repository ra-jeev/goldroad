const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { fireStore } = require('../common/init');
const { connectToDatabase } = require('../common/mongo');

const handleCurrStreak = (
  oldUserStreak,
  oldUserLastGame,
  newUserStreak,
  newUserLastGame,
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

  logger.log(
    `oldFirstSolvedGameInStreak: ${oldFirstSolvedGameInStreak}, oldLastSolvedGameNo: ${oldLastSolvedGameNo}`,
  );
  logger.log(
    `newFirstSolvedGameInStreak: ${newFirstSolvedGameInStreak}, newLastSolvedGameNo: ${newLastSolvedGameNo}`,
  );

  if (
    !newUserStreak &&
    oldUserStreak &&
    oldUserLastGame.gameNo >= newUserLastGame.gameNo
  ) {
    finalStreak = oldUserStreak;
    logger.log(
      `Since no newUser.data.currStreak, change currStreak to ${finalStreak}`,
    );
  } else if (oldUserStreak && newUserStreak) {
    if (
      oldLastSolvedGameNo === newLastSolvedGameNo &&
      oldUserStreak > newUserStreak
    ) {
      finalStreak = oldUserStreak;
      logger.log(
        `Since oldLastSolvedGameNo === newLastSolvedGameNo &&
         oldUserStreak > newUserStreak, change currStreak to ${finalStreak}`,
      );
    } else if (
      oldFirstSolvedGameInStreak === newFirstSolvedGameInStreak &&
      oldUserStreak > newUserStreak
    ) {
      finalStreak = oldUserStreak;
      logger.log(
        `Since oldFirstSolvedGameInStreak === newFirstSolvedGameInStreak &&
         oldUserStreak > newUserStreak, change currStreak to ${finalStreak}`,
      );
    } else if (oldLastSolvedGameNo > newLastSolvedGameNo) {
      if (oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1) {
        if (oldFirstSolvedGameInStreak < newFirstSolvedGameInStreak) {
          finalStreak = oldUserStreak;
          logger.log(
            `Since oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1 &&
           oldLastSolvedGameNo > newLastSolvedGameNo &&
            oldFirstSolvedGameInStreak < newFirstSolvedGameInStreak, change currStreak to ${finalStreak}`,
          );
        } else {
          finalStreak =
            newUserStreak + (oldLastSolvedGameNo - newLastSolvedGameNo);
          logger.log(
            `Since oldFirstSolvedGameInStreak <= newLastSolvedGameNo + 1 &&
           oldLastSolvedGameNo > newLastSolvedGameNo, change currStreak to ${finalStreak}`,
          );
        }
      } else if (oldFirstSolvedGameInStreak > newLastSolvedGameNo) {
        finalStreak = oldUserStreak;
        logger.log(
          `Since oldLastSolvedGameNo > newLastSolvedGameNo &&
          oldFirstSolvedGameInStreak > newLastSolvedGameNo, change currStreak to ${finalStreak}`,
        );
      }
    } else if (
      newLastSolvedGameNo > oldLastSolvedGameNo &&
      newFirstSolvedGameInStreak <= oldLastSolvedGameNo + 1 &&
      newFirstSolvedGameInStreak > oldFirstSolvedGameInStreak
    ) {
      finalStreak = oldUserStreak + (newLastSolvedGameNo - oldLastSolvedGameNo);
      logger.log(
        `Since newLastSolvedGameNo > oldLastSolvedGameNo &&
        newFirstSolvedGameInStreak <= oldLastSolvedGameNo + 1 &&
        newFirstSolvedGameInStreak > oldFirstSolvedGameInStreak, change currStreak to ${finalStreak}`,
      );
    }
  }

  return finalStreak;
};

exports.onNewMigration = onDocumentCreated(
  'migrations/{migrationId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.log('No data associated with the event');
      return null;
    }

    const data = snap.data();
    logger.log(`new migration job: ${JSON.stringify(data, null, 2)}`);

    if (
      !['realm', 'firebase'].includes(data.type) ||
      !data.oldUserId ||
      !data.newUserId
    ) {
      logger.log('Invalid migration data');
      return null;
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const userGamesCollection = db.collection('userGames');

    let updateOldGames = true;
    const time = new Date();

    if (data.type === 'firebase') {
      const oldUser = await usersCollection.findOne({ _id: data.oldUserId });
      if (!oldUser) {
        logger.log(`no oldUser found`);
        return null;
      }

      if (oldUser?.data.played) {
        const newUser = await usersCollection.findOne({ _id: data.newUserId });
        if (!newUser) {
          logger.log(`no newUser found`);
          return null;
        }

        const userChanges = {};
        const gamesToDelete = [];
        const gamesToModify = [];
        let oldGames = [];

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
            userChanges['data.firstGame'] = firstGame;
          }

          if (oldUser.data.longestStreak > newUser.data.longestStreak) {
            userChanges['data.longestStreak'] = oldUser.data.longestStreak;
          }

          if (oldUser.data.lastGamePlayed) {
            if (!newUser.data.lastGamePlayed) {
              userChanges['data.lastGamePlayed'] = oldUser.data.lastGamePlayed;
            } else {
              const newLastGamePlayed = newUser.data.lastGamePlayed;
              const oldLastGamePlayed = oldUser.data.lastGamePlayed;
              if (newLastGamePlayed.gameNo < oldLastGamePlayed.gameNo) {
                userChanges['data.lastGamePlayed'] = oldLastGamePlayed;
              } else if (
                newLastGamePlayed.gameNo === oldLastGamePlayed.gameNo
              ) {
                userChanges['data.lastGamePlayed.solved'] =
                  newLastGamePlayed.solved || oldLastGamePlayed.solved;
                userChanges['data.lastGamePlayed.tries'] =
                  newLastGamePlayed.tries + oldLastGamePlayed.tries;
                if (newLastGamePlayed.score < oldLastGamePlayed.score) {
                  userChanges['data.lastGamePlayed.score'] =
                    oldLastGamePlayed.score;
                  userChanges['data.lastGamePlayed.moves'] =
                    oldLastGamePlayed.moves;
                }
              }

              const streak = handleCurrStreak(
                oldUser.data.currStreak,
                oldLastGamePlayed,
                newUser.data.currStreak,
                newLastGamePlayed,
              );

              if (streak) {
                userChanges['data.currStreak'] = streak;
              }
            }
          }

          if (userChanges['data.currStreak']) {
            if (
              (userChanges['data.longestStreak'] &&
                userChanges['data.longestStreak'] <=
                  userChanges['data.currStreak']) ||
              (!userChanges['data.longestStreak'] &&
                userChanges['data.currStreak'] >= newUser.data.longestStreak)
            ) {
              userChanges['data.longestStreak'] =
                userChanges['data.currStreak'];
              userChanges['data.isCurrLongestStreak'] = true;
            } else if (newUser.data.isCurrLongestStreak) {
              userChanges['data.isCurrLongestStreak'] = false;
            }
          }

          oldGames = await userGamesCollection
            .find({ owner_id: data.oldUserId })
            .sort({ gameNo: -1 })
            .limit(oldUser.data.played)
            .toArray();

          if (oldGames.length) {
            const gamesToCheck = oldGames.map((g) => g.gameNo);
            const newGames = await userGamesCollection
              .find({ owner_id: data.newUserId, gameNo: { $in: gamesToCheck } })
              .sort({ gameNo: -1 })
              .toArray();

            if (newGames.length) {
              logger.log(`intersecting games length: ${newGames.length}`);
              newGames.forEach((newGame) => {
                const oldGameIndex = oldGames.findIndex(
                  (oldGame) => oldGame.gameNo === newGame.gameNo,
                );
                const oldGame = oldGames.splice(oldGameIndex, 1)[0];
                logger.log(`matching gameNo: ${oldGame.gameNo}`);

                for (const attempt of oldGame.attempts) {
                  attempt.mergedFrom = data.oldUserId;
                }

                const totalAttempts = [
                  ...newGame.attempts,
                  ...oldGame.attempts,
                ];
                newGamesPlayed--;
                if (oldGame.firstSolved >= 0 && newGame.firstSolved >= 0) {
                  newGamesSolves--;
                  solveStats[oldGame.attempts[oldGame.firstSolved].tries]--;
                  solveStats[newGame.attempts[newGame.firstSolved].tries]--;
                }

                totalAttempts.sort(
                  (a, b) => new Date(a.playedAt) - new Date(b.playedAt),
                );

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
                  updatedAt: time,
                };

                if (firstSolved > -1) {
                  finalChanges.firstSolved = firstSolved;
                  if (oldGame.firstSolved >= 0 && newGame.firstSolved >= 0) {
                    solveStats[totalAttempts[firstSolved].tries]++;
                  }
                }

                gamesToDelete.push(oldGame._id);
                gamesToModify.push({
                  filter: { _id: newGame._id },
                  update: { $set: finalChanges },
                });
              });
            }
          }

          userChanges['data.played'] = newGamesPlayed;
          userChanges['data.solves'] = newGamesSolves;
          if (Object.keys(solveStats).length) {
            for (const key in solveStats) {
              if (!solveStats[key]) {
                delete solveStats[key];
              }
            }
            userChanges['data.solveStats'] = solveStats;
          }

          if (Object.keys(gamesObj).length) {
            userChanges['data.games'] = gamesObj;
          }
        } else {
          userChanges.data = { ...oldUser.data };
        }

        logger.log(
          `final user changes: ${JSON.stringify(userChanges, null, 2)}`,
        );

        if (Object.keys(userChanges).length) {
          const updateRes = await usersCollection.updateOne(
            { _id: data.newUserId },
            { $set: { ...userChanges, updatedAt: time } },
          );
          logger.log(`updateUserResp: ${JSON.stringify(updateRes, null, 2)}`);

          const getUpdatedUser = await usersCollection.findOne({
            _id: data.newUserId,
          });
          logger.log(
            `getUpdatedUserResp: ${JSON.stringify(getUpdatedUser, null, 2)}`,
          );

          if (getUpdatedUser) {
            try {
              await fireStore
                .collection('migratedUsers')
                .doc(data.newUserId)
                .create(getUpdatedUser);
            } catch (error) {
              logger.log('failed to create the firestore document', error);
            }
          }
        }

        if (gamesToDelete.length) {
          logger.log(
            `gamesToDelete: ${JSON.stringify(gamesToDelete, null, 2)}`,
          );
          await userGamesCollection.updateMany(
            { _id: { $in: gamesToDelete } },
            {
              $set: {
                owner_id: 'delete',
                prev_owner_id: data.oldUserId,
                migrated_owner_id: data.newUserId,
                updatedAt: time,
              },
            },
          );
        }

        if (gamesToModify.length) {
          logger.log(
            `gamesToModify: ${JSON.stringify(gamesToModify, null, 2)}`,
          );
          const promises = gamesToModify.map((op) =>
            userGamesCollection.updateOne(op.filter, op.update),
          );
          await Promise.all(promises);
        }

        if (!oldGames.length && newUser.data.played) {
          logger.log(`no old gamesToUpdate to new user id`);
          updateOldGames = false;
        }
      } else {
        try {
          await fireStore
            .collection('migratedUsers')
            .doc(data.newUserId)
            .create({ status: 'Unmodified' });
        } catch (error) {
          logger.log('failed to create the firestore document', error);
        }
      }
    }

    if (updateOldGames) {
      await userGamesCollection.updateMany(
        { owner_id: data.oldUserId },
        {
          $set: {
            owner_id: data.newUserId,
            prev_owner_id: data.oldUserId,
            updatedAt: time,
          },
        },
      );
    }

    await usersCollection.updateOne(
      { _id: data.oldUserId },
      { $set: { migrated_id: data.newUserId, delete: true, updatedAt: time } },
    );

    return snap.ref.delete();
  },
);
