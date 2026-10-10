// Guards owner-only routes: reversing movements outside the undo window, closing or cancelling counts,
// editing or deactivating products, and managing staff.
// TODO(auth): once login exists, reject non-owners with 403 here and put the operator on req.user
// so services can fill recorded_by / started_by. Until then every request is let through.
const requireOwner = (req, res, next) => next();

module.exports = { requireOwner };
