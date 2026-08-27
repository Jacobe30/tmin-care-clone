const fs = require('fs');
const root = '/home/ubuntu/tmin-care-clone/supabase/functions/starter-api';
const payload = {
  project_id: 'eqiwbvzpxqfhtnantnge',
  name: 'starter-api',
  verify_jwt: true,
  entrypoint_path: 'index.ts',
  files: [
    {
      name: 'index.ts',
      content: fs.readFileSync(`${root}/index.ts`, 'utf8'),
    },
  ],
};
fs.writeFileSync(
  '/home/ubuntu/tmin-care-clone/supabase/functions/starter-api-deploy.json',
  `${JSON.stringify(payload, null, 2)}\n`,
);
