/* Edit these settings when the official links and images are available. */
window.FEUARTS_CONFIG = {
  contactEmail: "feuturearts@gmail.com", // From the group's design; confirm before publishing.
  logoImage: "images/logo/FEUARTS LOGO.png",
  groupImage: "images/organization/FEUARTS COMMUNITY.jpg",
  executivesPoster: "images/recruitment/Future Artist Committee Application 1.png",
  associatesPoster: "images/recruitment/Future Artist Committee Application 2.png",
  recruitmentQr: "", // Not used: the supplied application material consists of 2 posters.
  membershipUrl: "",
  socialLinks: { instagram: "https://www.instagram.com/feuture.arts", facebook: "https://www.facebook.com/FEUtureArts", discord: "https://discord.gg/tbgMYuDS3B?utm_source=Discord" },

  // Blank = working LOCAL DEMO. Files and details stay in this browser only.
  // A real receiver must accept a multipart/form-data POST and return JSON
  // { "success": true } only after storing the submission. See README.md.
  // Use an HTTPS endpoint that you control; never put secret keys here.
  artworkEndpoint: "",
  maxImageMB: 10,
  galleryPageSize: 3
};
