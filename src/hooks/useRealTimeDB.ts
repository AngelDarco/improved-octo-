import {
  getDatabase,
  ref,
  onValue,
  update,
  query,
  orderByChild,
  limitToLast,
  set,
} from "firebase/database";
import {
  intUpdateUserData,
  intContext,
  intAddFriend,
  intAddPersonalMessage,
  database,
} from "../types";
import { app } from "../firebase/firebase-config";
import { SnapshotData } from "vitest";
import { debounce } from "../utils/debounce";

// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

const useRealTimeDB = () => {
  /**  function to read the user Data from the firebase server, must be type Object to return users profiles or type Array to return messages
   * @param [dbPath="/public/"] - the path to the database
   * @param [callback] - the function to be called when the data is read or updated
   * @param [returnType] - the type of data to return, array or object
   */
  function readUserData(
    dbPath: database = "/public/",
    callback: (d: any) => void,
    returnType?: string
  ) {
    return new Promise((resolve, reject) => {
      if (!dbPath || typeof dbPath !== "string")
        return reject(new Error("invalid database path"));

      const starCountRef = query(
        ref(db, dbPath),
        orderByChild("messageSendTime"),
        limitToLast(150)
      );
      const debounceCaller = debounce(() => {
        onValue(starCountRef, (snapshot) => {
          const data: SnapshotData[] = [];

          if (snapshot.exists()) {
            if (returnType === "array") {
              snapshot.forEach((element) => {
                data.push(element.val());
              });
              callback(data);
              return resolve(data);
            }
            callback && callback(snapshot.val());
            return resolve(snapshot.val());
          }
          callback && callback([]);
          return reject(new Error("invalid database path"));
        });
      });

      debounceCaller();
      setTimeout(() => {
        reject(new Error("Something went wrong :("));
      }, 8000);
    });
  }

  // function to write the user Data in the firebase server
  async function writeUserData(props: intContext): Promise<string | Error> {
    if (!props) return Promise.reject(new Error("no data found"));
    if (!props.userName || !props.userUid)
      return Promise.reject(
        new Error("userUid, userName, lastName are required")
      );
    try {
      const { userUid, photo, userName, lastName, state, about } = props;

      await set(ref(db, "profiles/" + userUid), {
        lastName: lastName || "",
        state: state || "",
        about: about || "",
        photo,
        userName,
        userUid,
      });
      return "data writed";
    } catch (error) {
      return error as Error;
    }
  }

  // function to update the user messages in the firebase server
  async function updateUserData(props: intUpdateUserData | intAddFriend) {
    if (!props) return Promise.reject(new Error("no data found"));
    if (!(props as intUpdateUserData).userDB)
      return Promise.reject("userDB and messageId are required");

    // function to update the user messages in the firebase server
    interface updates {
      [key: string]: intAddFriend | intUpdateUserData | intAddPersonalMessage;
    }
    const updates: updates = {};
    const publicMessages = (props: intUpdateUserData) => {
      const {
        userName,
        message,
        messageSendTime,
        messageId,
        userDB = "/public/",
      } = props;

      return {
        [userDB + messageId]: {
          userName,
          message,
          messageSendTime,
        },
      };
    };

    //function to update the users friend list
    const addFriend = (props: intAddFriend) => {
      const { userDB, userUid, friendUid } = props;
      return {
        [userDB + userUid + "/" + friendUid]: {
          friendUid,
        },
      };
    };

    const addChats = (props: intAddPersonalMessage) => {
      const {
        userDB,
        uidFrom,
        uidTo,
        userName,
        message,
        messageId,
        messageSendTime,
      } = props;
      // userDB: `chats/${uidFrom}/${uidTo}`,
      return {
        [userDB + uidFrom + "/" + uidTo + "/" + messageId]: {
          userName,
          message,
          messageSendTime,
        },
      };
    };

    // Write the new post's data simultaneously in the posts list and the userId's post list.

    let dataUpdate = {};

    if (props.userDB === "/public/" || props.userDB === "tests/")
      dataUpdate = publicMessages(props as intUpdateUserData);
    else if (props.userDB === "chats/")
      dataUpdate = addChats(props as intAddPersonalMessage);
    else if (props.userDB === "friends/")
      dataUpdate = addFriend(props as intAddFriend);
    else return Promise.reject(new Error("invalid database path"));

    return new Promise((resolve, reject) => {
      update(ref(db), dataUpdate)
        .then(() => {
          return resolve("data updated");
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  return { readUserData, writeUserData, updateUserData };
};
export default useRealTimeDB;
