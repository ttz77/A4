import AuthenticatingConcept from "./concepts/authenticating";
import FriendingConcept from "./concepts/friending";
import PostingConcept from "./concepts/posting";
import SessioningConcept from "./concepts/sessioning";
import JoiningConcept from "./concepts/joining";
import VerifyingIdentityConcept from "./concepts/verifying";
import EndorsingConcept from "./concepts/endorsing";
import LocationSharingConcept from "./concepts/locationsharing";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const VerifyingIdentity = new VerifyingIdentityConcept("verifications");
export const Joining = new JoiningConcept("participations");
export const Endorsing = new EndorsingConcept("endorsements");
export const LocationSharing = new LocationSharingConcept("locations");
