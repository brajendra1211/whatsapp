const fs = require("fs");
const csv = require("csv-parser");
const Contact = require("../models/Contact");
const Audience = require("../models/Audience");

const normalizePhone = (phone = "") => {
  let clean = String(phone).replace(/[^\d]/g, "");

  // agar 0 se start ho raha ho to hata do
  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }

  // India local 10-digit number ho to 91 add karo
  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  return clean;
};

const LEAD_STAGES = ["new", "interested", "site_visit", "negotiation", "closed", "lost"];

const buildLeadProfilePayload = (body = {}) => {
  const payload = {};

  if (body.leadStage !== undefined) {
    payload.leadStage = LEAD_STAGES.includes(body.leadStage) ? body.leadStage : "new";
  }

  for (const key of [
    "leadSource",
    "budget",
    "dealValue",
    "propertyType",
    "requirementType",
    "preferredLocation",
    "preference",
    "reminderNote",
    "profileNote",
  ]) {
    if (body[key] !== undefined) {
      payload[key] = String(body[key] || "").trim();
    }
  }

  if (body.dealValue !== undefined && body.budget === undefined) {
    payload.budget = String(body.dealValue || "").trim();
  }
  if (body.requirementType !== undefined && body.propertyType === undefined) {
    payload.propertyType = String(body.requirementType || "").trim();
  }
  if (body.preference !== undefined && body.preferredLocation === undefined) {
    payload.preferredLocation = String(body.preference || "").trim();
  }

  if (body.reminderAt !== undefined) {
    const reminderDate = body.reminderAt ? new Date(body.reminderAt) : null;
    payload.reminderAt =
      reminderDate && !Number.isNaN(reminderDate.getTime()) ? reminderDate : null;
  }

  if (body.lastFollowUpAt !== undefined) {
    const followUpDate = body.lastFollowUpAt ? new Date(body.lastFollowUpAt) : null;
    payload.lastFollowUpAt =
      followUpDate && !Number.isNaN(followUpDate.getTime()) ? followUpDate : null;
  }

  return payload;
};

exports.listContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch contacts" });
  }
};

exports.addContact = async (req, res) => {
  try {
    const { name, phone, tags = [] } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || cleanPhone.length < 12) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const last10 = cleanPhone.slice(-10);

    const existing = await Contact.findOne({
      userId: req.user._id,
      $or: [
        { phone: cleanPhone },
        { phone: last10 },
        { phone: `0${last10}` },
      ],
    });

    if (existing) {
      return res.status(400).json({ message: "Contact already exists" });
    }

    const contact = await Contact.create({
      name: String(name).trim(),
      phone: cleanPhone,
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      ...buildLeadProfilePayload(req.body),
      userId: req.user._id,
    });

    return res.status(201).json(contact);
  } catch (error) {
    console.error("addContact error:", error);
    return res.status(500).json({ message: "Failed to add contact" });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { name, phone, tags = [] } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || cleanPhone.length < 12) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const duplicate = await Contact.findOne({
      _id: { $ne: req.params.id },
      userId: req.user._id,
      phone: cleanPhone,
    });

    if (duplicate) {
      return res.status(400).json({ message: "Another contact already uses this phone" });
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        name: String(name).trim(),
        phone: cleanPhone,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        ...buildLeadProfilePayload(req.body),
      },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    return res.json(contact);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update contact" });
  }
};

exports.updateLeadProfile = async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: buildLeadProfilePayload(req.body) },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    return res.json({ message: "Lead profile updated", contact });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update lead profile" });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    return res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete contact" });
  }
};

exports.importContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const results = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        let inserted = 0;
        let skipped = 0;
        let updated = 0;

        for (const row of results) {
          const name = (row.name || row.Name || "").trim();
          const cleanPhone = normalizePhone(
            row.phone || row.Phone || row.mobile || row.Mobile || ""
          );
          const tags = String(row.tags || row.Tags || "")
            .split(/[;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
          const leadProfile = buildLeadProfilePayload({
            leadStage: row.leadStage || row.Stage || row.stage,
            leadSource: row.leadSource || row.Source || row.source,
            dealValue: row.dealValue || row.DealValue || row.budget || row.Budget,
            requirementType:
              row.requirementType ||
              row.RequirementType ||
              row.propertyType ||
              row.PropertyType,
            preference:
              row.preference ||
              row.Preference ||
              row.preferredLocation ||
              row.PreferredLocation,
            reminderAt: row.reminderAt || row.ReminderAt,
            reminderNote: row.reminderNote || row.ReminderNote,
            profileNote: row.profileNote || row.ProfileNote,
          });

          if (!name || !cleanPhone) {
            skipped++;
            continue;
          }

          const last10 = cleanPhone.slice(-10);

          const existing = await Contact.findOne({
            userId: req.user._id,
            $or: [
              { phone: cleanPhone },
              { phone: last10 },
              { phone: `0${last10}` },
            ],
          });

          if (existing) {
            if (existing.phone !== cleanPhone) {
              existing.phone = cleanPhone;
              if (!existing.name && name) {
                existing.name = name;
              }
              if (tags.length) {
                existing.tags = [...new Set([...(existing.tags || []), ...tags])];
              }
              await existing.save();
              updated++;
            } else {
              skipped++;
            }
            continue;
          }

          await Contact.create({
            name,
            phone: cleanPhone,
            tags,
            ...leadProfile,
            userId: req.user._id,
          });

          inserted++;
        }

        fs.unlink(req.file.path, () => {});

        return res.json({
          message: "CSV imported successfully",
          inserted,
          updated,
          skipped,
        });
      });
  } catch (error) {
    console.error("importContacts error:", error);
    return res.status(500).json({ message: "CSV import failed" });
  }
};

exports.bulkTagContacts = async (req, res) => {
  try {
    const { contactIds = [], tags = [] } = req.body;
    const cleanTags = Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    if (!contactIds.length || !cleanTags.length) {
      return res.status(400).json({ message: "Contacts and tags are required" });
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, userId: req.user._id },
      { $addToSet: { tags: { $each: cleanTags } } }
    );

    return res.json({
      message: "Tags applied successfully",
      modified: result.modifiedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to tag contacts" });
  }
};

exports.bulkAddToAudience = async (req, res) => {
  try {
    const { contactIds = [], audienceId } = req.body;

    if (!contactIds.length || !audienceId) {
      return res.status(400).json({ message: "Contacts and audience are required" });
    }

    const audience = await Audience.findOneAndUpdate(
      { _id: audienceId, userId: req.user._id },
      { $addToSet: { contacts: { $each: contactIds } } },
      { new: true }
    );

    if (!audience) {
      return res.status(404).json({ message: "Audience not found" });
    }

    return res.json({
      message: "Contacts added to audience",
      audience,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add contacts to audience" });
  }
};
