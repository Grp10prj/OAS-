import { useState, useEffect, useContext } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import { itemStatus } from "../utils/itemStatus";
import { formatField, formatMoney } from "../utils/formatString";
import { updateProfile, signInWithEmailAndPassword } from "firebase/auth"; // Added signInWithEmailAndPassword
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore"; // Added getDoc
import { auth, db } from "../firebase/config";
import { ModalsContext } from "../contexts/ModalsProvider";
import { ModalTypes } from "../utils/modalTypes";

const Modal = ({ type, title, children }) => {
  const { closeModal, currentModal } = useContext(ModalsContext);

  if (type !== currentModal) return null;

  return ReactDOM.createPortal(
    <div
      className="modal fade show"
      style={{ display: "block" }}
      onClick={closeModal}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={closeModal} />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

Modal.propTypes = {
  type: PropTypes.string,
  title: PropTypes.string,
  children: PropTypes.arrayOf(PropTypes.element)
}

const ItemModal = () => {
  const { activeItem, openModal, closeModal } = useContext(ModalsContext);
  const [secondaryImageSrc, setSecondaryImageSrc] = useState("");
  const minIncrease = 1;
  const [bid, setBid] = useState("");
  const [valid, setValid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [minBid, setMinBid] = useState("-.--");

  useEffect(() => {
    if (activeItem.secondaryImage === undefined) return;
    import(`../assets/${activeItem.secondaryImage}.png`).then((src) => {
      setSecondaryImageSrc(src.default)
    })
  }, [activeItem.secondaryImage])

  useEffect(() => {
    const status = itemStatus(activeItem);
    setMinBid(formatMoney(activeItem.currency, status.amount + minIncrease));
  }, [activeItem]);

  const delayedClose = () => {
    setTimeout(() => {
      closeModal();
      setFeedback("");
      setValid("");
    }, 1000);
  };

  const handleSubmitBid = () => {
    // Get bid submission time as early as possible
    let nowTime = new Date().getTime();
    // Disable bid submission while we submit the current request
    setIsSubmitting(true);
    // Ensure item has not already ended
    if (activeItem.endTime - nowTime < 0) {
      setFeedback("Sorry, this item has ended!");
      setValid("is-invalid");
      delayedClose();
      setIsSubmitting(false);
      return;
    }
    // Ensure user has provided a username
    if (!auth.currentUser.displayName) {
      setFeedback("You must provide a username before bidding!");
      setValid("is-invalid");
      setTimeout(() => {
        openModal(ModalTypes.SIGN_UP);
        setIsSubmitting(false);
        setValid("");
      }, 1000)
      return;
    }
    // Ensure input is a monetary value
    if (!/^\d+(\.\d{1,2})?$/.test(bid)) {
      setFeedback("Please enter a valid monetary amount!");
      setValid("is-invalid");
      setIsSubmitting(false);
      return;
    }
    // Get values needed to place bid
    const amount = parseFloat(bid);
    const status = itemStatus(activeItem);
    // Ensure input is large enough
    if (amount < status.amount + minIncrease) {
      setFeedback("You did not bid enough!");
      setValid("is-invalid");
      setIsSubmitting(false);
      return;
    }
    // Finally, place bid
    updateDoc(doc(db, "auction", "items"), {
      [formatField(activeItem.id, status.bids + 1)]: {
        amount,
        uid: auth.currentUser.uid,
      },
    });
    console.debug("handleSubmidBid() write to auction/items");
    setValid("is-valid");
    delayedClose();
  };

  const handleChange = (e) => {
    setBid(e.target.value);
    setIsSubmitting(false);
    setValid("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isSubmitting) {
      handleSubmitBid();
    }
  };

  const handleSignIn = (email, password) => {
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        // Check if user is admin
        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (docSnap.exists() && docSnap.data().admin) {
            console.debug("User is admin");
            // Set admin state or redirect to admin panel, etc.
          }
        });
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error(errorCode, errorMessage);
        // Handle sign-in errors
      });
  };

  return (
    <Modal type={ModalTypes.ITEM} title={activeItem.title}>
      <div className="modal-body">
        <p>{activeItem.detail}</p>
        <img src={secondaryImageSrc} className="img-fluid" alt={activeItem.title} />
      </div>
      <div className="modal-footer justify-content-start">
        <div className="input-group mb-2">
          <span className="input-group-text">{activeItem.currency}</span>
          <input
            className={`form-control ${valid}`}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            />
          <button
            type="submit"
            className="btn btn-primary"
            onClick={handleSubmitBid}
            disabled={isSubmitting}
            >
            Submit bid
          </button>
          <div className="invalid-feedback">{feedback}</div>
        </div>
        <label className="form-label">Enter {minBid} or more</label>
        <p className="text-muted">(This is just a demo, you&apos;re not bidding real money)</p>
      </div>
    </Modal>
  );
};

const SignUpModal = () => {
  const { closeModal } = useContext(ModalsContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [validEmail, setValidEmail] = useState("");
  const [validPassword, setValidPassword] = useState("");
  const [validUsername, setValidUsername] = useState("");

  const handleSignUp = () => {
    // Validate email, password, and username
    if (!validateEmail(email) || password.length < 6 || !username.trim()) {
      // Show validation errors if any
      setValidEmail(validateEmail(email) ? "" : "is-invalid");
      setValidPassword(password.length >= 6 ? "" : "is-invalid");
      setValidUsername(username.trim() ? "" : "is-invalid");
      return;
    }

    // Create user with email and password
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Update user profile with username
        const user = userCredential.user;
        return updateProfile(user, {
          displayName: username
        });
      })
      .then(() => {
        // Store additional user info in Firestore
        return setDoc(doc(db, "users", auth.currentUser.uid), {
          name: username,
          admin: false // Initially set as non-admin
        });
      })
      .then(() => {
        console.debug(`SignUpModal: User signed up successfully.`);
        // Close modal on successful signup
        closeModal();
      })
      .catch((error) => {
        // Handle signup errors
        console.error(`SignUpModal: Error signing up: ${error.code} - ${error.message}`);
        // You can display appropriate error messages to the user
      });
  };

  const validateEmail = (email) => {
    // Simple email validation regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <Modal type={ModalTypes.SIGN_UP} title="Sign up for Markatplace Auction">
      <div className="modal-body">
        <p>
          Please enter your email, password, and username to sign up.
        </p>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-floating mb-3">
            <input
              autoFocus
              id="email-input"
              type="email"
              className={`form-control ${validEmail}`}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Email</label>
            <div className="invalid-feedback">Please enter a valid email address.</div>
          </div>
          <div className="form-floating mb-3">
            <input
              id="password-input"
              type="password"
              className={`form-control ${validPassword}`}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label>Password</label>
            <div className="invalid-feedback">Password must be at least 6 characters long.</div>
          </div>
          <div className="form-floating mb-3">
            <input
              id="username-input"
              type="text"
              className={`form-control ${validUsername}`}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label>Username</label>
            <div className="invalid-feedback">Please enter a username.</div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          onClick={handleSignUp}
        >
          Sign up
        </button>
      </div>
    </Modal>
  );
};

export { ItemModal, SignUpModal };
