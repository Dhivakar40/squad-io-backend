require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows everyone to connect
app.use(express.json()); // Allows parsing JSON data
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
// Routes
const matchRoutes = require('./routes/matchRoutes');
app.use('/api/match', matchRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('College Connect Backend is Running! 🚀');
});

// ---------------- PROFILE UPDATE ENDPOINT ----------------

app.post('/api/user/update-profile', async (req, res) => {
    const { userId, fullName, department, year, bio, github, linkedin, skills } = req.body;

    if (!userId || !fullName) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Update the Basic User Details
        const { error: userError } = await supabase
            .from('users')
            .update({
                full_name: fullName,
                department: department,
                year_of_study: parseInt(year),
                bio: bio,
                github_handle: github,
                linkedin_handle: linkedin,
                last_active_at: new Date(),
                is_looking_for_team: true // Default to looking
            })
            .eq('id', userId);

        if (userError) throw userError;

        // 2. Handle Skills (The Tricky Part)
        if (skills && skills.length > 0) {
            // A. Remove old skills first (to avoid duplicates/mess)
            await supabase.from('user_skills').delete().eq('user_id', userId);

            for (const skillName of skills) {
                // B. Check if skill exists, or create it
                let skillId;
                const { data: existingSkill } = await supabase
                    .from('skills')
                    .select('id')
                    .ilike('name', skillName) // Case insensitive check
                    .single();

                if (existingSkill) {
                    skillId = existingSkill.id;
                } else {
                    // Create new skill
                    const { data: newSkill, error: skillError } = await supabase
                        .from('skills')
                        .insert({ name: skillName })
                        .select()
                        .single();
                    if (skillError) continue; // Skip if error
                    skillId = newSkill.id;
                }

                // C. Link User to Skill
                await supabase.from('user_skills').insert({
                    user_id: userId,
                    skill_id: skillId
                });
            }
        }

        res.json({ message: "Profile updated successfully!" });

    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`To test locally: http://localhost:${port}/api/match/find-teammates`);
});