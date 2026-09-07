import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { UserRole, ProjectStatus, ApplicationStatus } from '../src/generated/prisma/enums.js';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing existing data...');

  await prisma.clientProfile.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.escrow.deleteMany({});
  await prisma.freelancerProfile.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.portfolioItem.deleteMany({});
  await prisma.projectApplication.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.withdrawal.deleteMany({});

  console.log('Seeding database...');

  // Freelancer Data
  const freelancers = [
    { name: 'Bayu Wijaya', email: 'bayu@karyaloka.com', first: 'bayu', skills: ['React', 'Node.js', 'TypeScript'] },
    { name: 'Budi Santoso', email: 'budi@karyaloka.com', first: 'budi', skills: ['UI/UX', 'Figma'] },
    { name: 'Siti Aminah', email: 'siti@karyaloka.com', first: 'siti', skills: ['SEO', 'Content Writing'] },
    { name: 'Agus Setiawan', email: 'agus@karyaloka.com', first: 'agus', skills: ['Python', 'Data Analysis'] },
    { name: 'Putri Lestari', email: 'putri@karyaloka.com', first: 'putri', skills: ['Graphic Design', 'Illustration'] },
    { name: 'Dewi Sartika', email: 'dewi@karyaloka.com', first: 'dewi', skills: ['Digital Marketing', 'Facebook Ads'] },
    { name: 'Rudi Hartono', email: 'rudi@karyaloka.com', first: 'rudi', skills: ['Java', 'Spring Boot', 'Backend'] },
    { name: 'Sri Wahyuni', email: 'sri@karyaloka.com', first: 'sri', skills: ['Copywriting', 'Translation'] },
    {
      name: 'Hendra Gunawan',
      email: 'hendra@karyaloka.com',
      first: 'hendra',
      skills: ['Video Editing', 'After Effects'],
    },
    { name: 'Rina Wati', email: 'rina@karyaloka.com', first: 'rina', skills: ['React Native', 'Mobile Dev'] },
  ];

  // Client Data
  const clients = [
    { name: 'Andi Saputra', email: 'andi@karyaloka.com', first: 'andi' },
    { name: 'Maya Indah', email: 'maya@karyaloka.com', first: 'maya' },
    { name: 'Doni Pratama', email: 'doni@karyaloka.com', first: 'doni' },
    { name: 'Tari Utami', email: 'tari@karyaloka.com', first: 'tari' },
    { name: 'Kiki Amalia', email: 'kiki@karyaloka.com', first: 'kiki' },
  ];

  const createdFreelancers = [];
  const createdClients = [];

  for (const f of freelancers) {
    const passwordHash = await bcrypt.hash(`${f.first}123`, 10);
    const user = await prisma.user.create({
      data: {
        name: f.name,
        email: f.email,
        passwordHash,
        phone: '081234567890',
        role: UserRole.FREELANCER,
        freelancerProfile: {
          create: {
            skills: f.skills,
            description: `Halo, saya ${f.name}, seorang profesional di bidang ${f.skills.join(', ')}.`,
            wallet: { create: { balance: 0 } },
          },
        },
      },
      include: { freelancerProfile: true },
    });
    createdFreelancers.push(user);
    console.log(`Created Freelancer: ${user.name}`);
  }

  for (const c of clients) {
    const passwordHash = await bcrypt.hash(`${c.first}123`, 10);
    const user = await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        passwordHash,
        phone: '089876543210',
        role: UserRole.CLIENT,
        clientProfile: {
          create: {
            description: `Perusahaan rintisan yang dipimpin oleh ${c.name}.`,
          },
        },
      },
      include: { clientProfile: true },
    });
    createdClients.push(user);
    console.log(`Created Client: ${user.name}`);
  }

  // Projects Data
  const projectTemplates = [
    { title: 'Pembuatan Aplikasi Kasir', desc: 'Butuh aplikasi kasir berbasis web dengan React.', budget: 5000000 },
    { title: 'Desain Logo Perusahaan', desc: 'Logo minimalis untuk perusahaan startup.', budget: 1500000 },
    { title: 'Pembuatan Website Company Profile', desc: 'Website 5 halaman menggunakan Next.js.', budget: 3500000 },
    { title: 'Video Animasi Promosi', desc: 'Video animasi 1 menit untuk iklan produk.', budget: 2000000 },
    { title: 'Penulisan Artikel SEO', desc: '10 artikel SEO tentang teknologi dan gadget.', budget: 1000000 },
    {
      title: 'Aplikasi Mobile E-Commerce',
      desc: 'Aplikasi toko online di Android & iOS dengan React Native.',
      budget: 15000000,
    },
    { title: 'Desain UI/UX Dashboard', desc: 'Desain UI/UX dashboard admin 10 screen.', budget: 4000000 },
    { title: 'Optimasi Database PostgreSQL', desc: 'Tuning query dan optimasi indexing.', budget: 2500000 },
    { title: 'Pembuatan Landing Page Kampanye', desc: 'Landing page event dengan form pendaftaran.', budget: 1200000 },
    { title: 'Setting Server AWS', desc: 'Setup EC2, RDS, dan S3 untuk aplikasi web.', budget: 3000000 },
  ];

  for (let i = 0; i < projectTemplates.length; i++) {
    const t = projectTemplates[i];
    const clientUser = createdClients[i % createdClients.length];

    let status: ProjectStatus = ProjectStatus.OPEN;
    if (i % 3 === 1) status = ProjectStatus.IN_PROGRESS;
    if (i % 3 === 2) status = ProjectStatus.COMPLETED;

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14); // 14 days from now

    const project = await prisma.project.create({
      data: {
        title: t.title,
        description: t.desc,
        budget: t.budget,
        deadline,
        status,
        skills: ['JavaScript', 'Design', 'General'],
        clientId: clientUser.clientProfile!.id,
      },
    });

    console.log(`Created Project: ${project.title} (Status: ${status})`);

    // Add applications if project is not OPEN
    if (status !== ProjectStatus.OPEN) {
      const assignedFreelancer = createdFreelancers[i % createdFreelancers.length];

      await prisma.projectApplication.create({
        data: {
          projectId: project.id,
          freelancerId: assignedFreelancer.freelancerProfile!.id,
          status: ApplicationStatus.HIRED,
        },
      });

      await prisma.project.update({
        where: { id: project.id },
        data: { assignedFreelancerId: assignedFreelancer.freelancerProfile!.id },
      });
    } else {
      // Create some random applications
      await prisma.projectApplication.create({
        data: {
          projectId: project.id,
          freelancerId: createdFreelancers[(i + 1) % createdFreelancers.length].freelancerProfile!.id,
          status: ApplicationStatus.APPLIED,
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
