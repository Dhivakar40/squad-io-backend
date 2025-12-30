const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// API Endpoint: GET /api/match/find-teammates?userId=...
router.get('/find-teammates', async (req, res) => {
    const { userId } = req.query;

    try {
        // 1. Get the current user's profile and skills
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('*, user_skills(skills(name))') // Fetches skill names too
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        const myDept = currentUser.department;
        // Flatten skills into a simple array, e.g., ['Python', 'Flutter']
        const mySkills = currentUser.user_skills.map(us => us.skills.name); 

        // 2. Get Potential Candidates (Exclude Self + Exclude Ghosts)
        // Logic: Get everyone who was active in last 30 days AND is looking for a team
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: candidates, error: candError } = await supabase
            .from('users')
            .select('*, user_skills(skills(name))')
            .neq('id', userId) // Not me
            .eq('is_looking_for_team', true) // Must be looking
            .gt('last_active_at', thirtyDaysAgo.toISOString()); // Not a ghost

        if (candError) throw candError;

        // 3. THE ALGORITHM: Score each candidate
        const scoredCandidates = candidates.map(candidate => {
            let score = 0;
            const theirSkills = candidate.user_skills.map(us => us.skills.name);

            // A. Skill Match (Highest Priority)
            // If they have a skill I don't (or we need), give points.
            // For simplicity: +10 points for every skill they have.
            // (You can refine this to specific needed skills later)
            score += theirSkills.length * 10; 

            // B. Inter-Department (Medium Priority)
            // If they are from a DIFFERENT department, give +20 points
            if (candidate.department !== myDept) {
                score += 20; 
            }

            // C. Year of Study (Lowest Priority)
            // Prefer students in the same year or 1 year gap
            const yearDiff = Math.abs(candidate.year_of_study - currentUser.year_of_study);
            if (yearDiff <= 1) {
                score += 5;
            }

            return { ...candidate, score };
        });

        // 4. Sort by Score (High to Low)
        scoredCandidates.sort((a, b) => b.score - a.score);

        // 5. Send back the Top 10 matches
        res.json(scoredCandidates.slice(0, 10));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;