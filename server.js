require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows everyone to connect
app.use(express.json()); // Allows parsing JSON data

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Routes
const matchRoutes = require('./routes/matchRoutes');
app.use('/api/match', matchRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('College Connect Backend is Running on Vercel! 🚀');
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
                is_looking_for_team: true
            })
            .eq('id', userId);

        if (userError) throw userError;

        // 2. Handle Skills
        if (skills && skills.length > 0) {
            await supabase.from('user_skills').delete().eq('user_id', userId);

            for (const skillName of skills) {
                let skillId;
                const { data: existingSkill } = await supabase
                    .from('skills')
                    .select('id')
                    .ilike('name', skillName)
                    .single();

                if (existingSkill) {
                    skillId = existingSkill.id;
                } else {
                    const { data: newSkill, error: skillError } = await supabase
                        .from('skills')
                        .insert({ name: skillName })
                        .select()
                        .single();
                    if (skillError) continue;
                    skillId = newSkill.id;
                }

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

// ---------------- CREATE TEAM ENDPOINT ----------------
app.post('/api/teams/create', async (req, res) => {
    const { name, description, leaderId, bucketId } = req.body;

    if (!name || !leaderId) {
        return res.status(400).json({ error: "Team name and Leader ID are required" });
    }

    try {
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert({
                name,
                description,
                leader_id: leaderId,
                bucket_id: bucketId,
                looking_for_members: true
            })
            .select()
            .single();

        if (teamError) throw teamError;

        const { error: memberError } = await supabase
            .from('team_members')
            .insert({
                team_id: team.id,
                user_id: leaderId,
                role: 'leader'
            });

        if (memberError) throw memberError;

        res.json({ message: "Team created successfully!", teamId: team.id });

    } catch (error) {
        console.error("Create Team Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------- SEND INVITE ENDPOINT (RESTORED) ----------------
app.post('/api/teams/invite', async (req, res) => {
    const { senderId, receiverId, teamId } = req.body;

    if (!senderId || !receiverId || !teamId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const { data: existing } = await supabase
            .from('requests')
            .select('*')
            .eq('sender_id', senderId)
            .eq('receiver_id', receiverId)
            .eq('team_id', teamId)
            .eq('status', 'pending')
            .single();

        if (existing) {
            return res.status(400).json({ error: "Invite already pending" });
        }

        const { error } = await supabase
            .from('requests')
            .insert({
                sender_id: senderId,
                receiver_id: receiverId,
                team_id: teamId,
                type: 'invite',
                status: 'pending'
            });

        if (error) throw error;

        res.json({ message: "Invite sent successfully!" });

    } catch (error) {
        console.error("Invite Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------- GET MY INVITES ----------------
app.get('/api/user/invites/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const { data, error } = await supabase
            .from('requests')
            .select(`
                id, status, created_at,
                teams ( id, name, description )
            `)
            .eq('receiver_id', userId)
            .eq('status', 'pending');

        if (error) throw error;
        res.json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------------- RESPOND TO INVITE (Accept/Reject) ----------------
app.post('/api/invites/respond', async (req, res) => {
    const { requestId, status, userId, teamId } = req.body;

    try {
        const { error: updateError } = await supabase
            .from('requests')
            .update({ status: status })
            .eq('id', requestId);

        if (updateError) throw updateError;

        if (status === 'accepted') {
            const { error: joinError } = await supabase
                .from('team_members')
                .insert({
                    team_id: teamId,
                    user_id: userId,
                    role: 'member'
                });

            if (joinError) throw joinError;
        }

        res.json({ message: `Invite ${status}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running locally on http://localhost:${port}`);
    });
}

// Export the app so Vercel can run it as a serverless function
module.exports = app;