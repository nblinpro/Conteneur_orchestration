# appscore/ : code de l'application (fourni par l'enseignant)

Code source de l'application **dotnetgigs** et ses Dockerfile, utilisés tels quels pour builder les images
(voir la section 5 du [README principal](../README.md)). Nous n'avons pas modifié ce code.

```
appscore/
├── Web/                       site web ASP.NET Core MVC (+ Dockerfile)
├── Services/
│   ├── Jobs.Api/              API REST des offres d'emploi (+ Dockerfile)
│   ├── Applicants.Api/        API REST des candidats (+ Dockerfile)
│   └── Identity.Api/          API REST d'authentification (+ Dockerfile)
├── Foundation/
│   ├── Events/                événements échangés par RabbitMQ (ApplicantAppliedEvent)
│   └── Http/                  code HTTP partagé, utilisé par Web
├── Database/                  image SQL Server : Dockerfile + scripts de création des bases
├── docker-compose.yml         version Docker Compose d'origine (référence pour les liens et variables)
└── dotnetgigs.sln             solution .NET regroupant tous les projets
```

| Image | Dockerfile | Contexte de build |
|---|---|---|
| `nicoter04/dotnetgigs_bd:web` | `Web/Dockerfile` | `appscore/` |
| `nicoter04/dotnetgigs_bd:jobs-api` | `Services/Jobs.Api/Dockerfile` | `appscore/` |
| `nicoter04/dotnetgigs_bd:applicants-api` | `Services/Applicants.Api/Dockerfile` | `appscore/` |
| `nicoter04/dotnetgigs_bd:identity-api` | `Services/Identity.Api/Dockerfile` | `appscore/` |
| `nicoter04/dotnetgigs_bd:sql-data` | `Database/Dockerfile` | `appscore/Database/` |

À savoir : le mot de passe SQL `Pass@word` est écrit en dur dans `Database/Dockerfile` et `Database/SqlCmdStartup.sh`
(voir « Mots de passe et chiffrement » dans le README principal).
