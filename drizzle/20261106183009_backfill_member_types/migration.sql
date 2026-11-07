-- Custom migration (#333): the one approved exception to generated migrations.
-- Runs after the migration that adds member_types and makes members.member_type
-- and organization_config.key text, and before the one that adds the foreign
-- key from members to member_types.

-- Every organization with member types on, or with any member that has a type,
-- gets the two types Sprint 4 hard-coded. Applicant is the signup default, as
-- signup assigned it before.
INSERT INTO "member_types" ("organization_id", "key", "label", "plural_label", "position", "is_signup_default")
SELECT "organizations"."id", "builtin"."key", "builtin"."label", "builtin"."plural_label", "builtin"."position", "builtin"."is_signup_default"
FROM "organizations"
CROSS JOIN (
	VALUES
		('applicant', 'Applicant', 'Applicants', 0, true),
		('attendee', 'Current Attendee', 'Current Attendees', 1, false)
) AS "builtin" ("key", "label", "plural_label", "position", "is_signup_default")
WHERE EXISTS (
		SELECT 1 FROM "organization_config"
		WHERE "organization_config"."organization_id" = "organizations"."id"
			AND "organization_config"."key" = 'member_types_enabled'
			AND "organization_config"."value" = 'true'
	)
	OR EXISTS (
		SELECT 1 FROM "members"
		WHERE "members"."organization_id" = "organizations"."id"
			AND "members"."member_type" IS NOT NULL
	)
ON CONFLICT ("organization_id", "key") DO NOTHING;
--> statement-breakpoint
-- Move each organization's applicant and attendee dashboard layouts into one
-- member_type_dashboard_layouts row, keyed by member type, then delete the old
-- rows. A stored value that isn't a JSON object was already ignored (that type
-- got the member layout), so it's dropped.
DO $$
DECLARE
	org_id text;
	type_key text;
	stored text;
	layout jsonb;
	layouts jsonb;
BEGIN
	FOR org_id IN
		SELECT DISTINCT "organization_id" FROM "organization_config"
		WHERE "key" IN ('applicant_dashboard_layout', 'attendee_dashboard_layout')
	LOOP
		layouts := '{}'::jsonb;
		FOREACH type_key IN ARRAY ARRAY['applicant', 'attendee'] LOOP
			SELECT "value" INTO stored FROM "organization_config"
			WHERE "organization_id" = org_id AND "key" = type_key || '_dashboard_layout'
			LIMIT 1;
			layout := NULL;
			IF stored IS NOT NULL THEN
				BEGIN
					layout := stored::jsonb;
				EXCEPTION WHEN others THEN
					layout := NULL;
				END;
			END IF;
			IF layout IS NOT NULL AND jsonb_typeof(layout) = 'object' THEN
				layouts := layouts || jsonb_build_object(type_key, layout);
			END IF;
		END LOOP;
		IF layouts <> '{}'::jsonb AND NOT EXISTS (
			SELECT 1 FROM "organization_config"
			WHERE "organization_id" = org_id AND "key" = 'member_type_dashboard_layouts'
		) THEN
			INSERT INTO "organization_config" ("id", "organization_id", "key", "value")
			VALUES (gen_random_uuid()::text, org_id, 'member_type_dashboard_layouts', layouts::text);
		END IF;
	END LOOP;
	DELETE FROM "organization_config"
	WHERE "key" IN ('applicant_dashboard_layout', 'attendee_dashboard_layout');
END $$;
