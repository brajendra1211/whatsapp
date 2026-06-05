const Audience = require("../models/Audience");
const Contact = require("../models/Contact");

exports.listAudiences = async (req, res) => {
  try {
    const allContactsCount = await Contact.countDocuments({
      userId: req.user._id,
    });

    const audiences = await Audience.find({
      userId: req.user._id,
    }).populate("contacts");

    const finalAudiences = audiences.map((a) => ({
      _id: a._id,
      name: a.name,
      description: a.description,
      total: a.contacts?.length || 0,
    }));

    return res.json({
      audiences: [
        {
          _id: "all",
          name: "All Contacts",
          total: allContactsCount,
        },
        ...finalAudiences,
      ],
    });
  } catch (error) {
    console.error("listAudiences error:", error);
    return res.status(500).json({ message: "Failed to fetch audiences" });
  }
};

exports.createAudience = async (req, res) => {
  try {
    const { name, description = "", contactIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Audience name is required" });
    }

    const audience = await Audience.create({
      name,
      description,
      contacts: contactIds,
      userId: req.user._id,
    });

    return res.status(201).json({
      message: "Audience created successfully",
      audience,
    });
  } catch (error) {
    console.error("createAudience error:", error);
    return res.status(500).json({ message: "Failed to create audience" });
  }
};

exports.updateAudience = async (req, res) => {
  try {
    const { name, description = "", contactIds = [] } = req.body;

    const audience = await Audience.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, description, contacts: contactIds },
      { new: true }
    );

    if (!audience) {
      return res.status(404).json({ message: "Audience not found" });
    }

    return res.json({
      message: "Audience updated successfully",
      audience,
    });
  } catch (error) {
    console.error("updateAudience error:", error);
    return res.status(500).json({ message: "Failed to update audience" });
  }
};

exports.deleteAudience = async (req, res) => {
  try {
    const audience = await Audience.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!audience) {
      return res.status(404).json({ message: "Audience not found" });
    }

    return res.json({ message: "Audience deleted successfully" });
  } catch (error) {
    console.error("deleteAudience error:", error);
    return res.status(500).json({ message: "Failed to delete audience" });
  }
};